import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  FileText,
  ListChecks,
  MessageCircle,
  Mic,
  MicOff,
  PhoneOff,
  ShieldCheck,
  Sparkles,
  Video,
  VideoOff,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
const rtcConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

function errorText(error) {
  const data = error.response?.data;
  return (
    data?.detail ||
    Object.values(data || {})
      .flat()
      .find(Boolean) ||
    error.message ||
    "Could not connect to the meeting."
  );
}

export default function MeetingPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [answers, setAnswers] = useState([]);
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const streamRef = useRef(null);
  const chatEndRef = useRef(null);
  const leavingRef = useRef(false);
  const pendingCandidatesRef = useRef([]);
  const makingOfferRef = useRef(false);
  const offerSentRef = useRef(false);
  const initiatorRef = useRef(false);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const iceRestartRequestedRef = useRef(false);
  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [questions, setQuestions] = useState([]);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [peerDetected, setPeerDetected] = useState(false);
  const [status, setStatus] = useState("Waiting for another participant...");
  const [error, setError] = useState("");

  const cleanup = useCallback((notify = false) => {
    const socket = socketRef.current;
    if (notify && socket?.readyState === WebSocket.OPEN)
      socket.send(JSON.stringify({ type: "leave" }));
    socketRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
    pendingCandidatesRef.current = [];
    makingOfferRef.current = false;
    offerSentRef.current = false;
    iceRestartRequestedRef.current = false;
    clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close();
  }, []);

  const log = useCallback(
    (message, details) =>
      console.info(`[WebRTC ${code}] ${message}`, details || ""),
    [code],
  );

  const startLocalMedia = useCallback(async () => {
    if (streamRef.current) return streamRef.current;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser does not support camera and microphone access.");
      return null;
    }
    try {
      log("Requesting local camera and microphone");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      if (leavingRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return null;
      }
      streamRef.current = stream;
      if (localVideo.current) localVideo.current.srcObject = stream;
      log(
        "Local media ready",
        stream.getTracks().map((track) => `${track.kind}:${track.label}`),
      );
      return stream;
    } catch (mediaError) {
      const messages = {
        NotAllowedError:
          "Camera and microphone permission is required to join this interview.",
        NotFoundError:
          "No camera or microphone was found. Connect a device and try again.",
        NotReadableError:
          "Your camera or microphone is being used by another application.",
        OverconstrainedError:
          "Your camera or microphone cannot satisfy the requested settings.",
      };
      console.error(`[WebRTC ${code}] Local media failed`, mediaError);
      setError(
        messages[mediaError.name] ||
          `Camera or microphone could not be started (${mediaError.name || "unknown error"}).`,
      );
      return null;
    }
  }, [code, log]);

  const flushPendingCandidates = useCallback(
    async (peer) => {
      if (
        !peer?.remoteDescription?.type ||
        !pendingCandidatesRef.current.length
      )
        return;
      const candidates = pendingCandidatesRef.current.splice(0);
      log("Adding queued ICE candidates", candidates.length);
      for (const candidate of candidates) {
        try {
          await peer.addIceCandidate(candidate);
        } catch (candidateError) {
          console.error(
            `[WebRTC ${code}] Queued ICE candidate failed`,
            candidateError,
          );
        }
      }
    },
    [code, log],
  );

  const ensurePeerConnection = useCallback(async () => {
    let peer = peerRef.current;
    if (!peer) {
      const stream = await startLocalMedia();
      if (!stream || leavingRef.current) return null;
      try {
        peer = new RTCPeerConnection(rtcConfig);
        peerRef.current = peer;
        log("Created RTCPeerConnection");
        stream.getTracks().forEach((track) => peer.addTrack(track, stream));

        peer.ontrack = ({ streams }) => {
          if (remoteVideo.current) {
            remoteVideo.current.srcObject = streams[0];
          }
          setPeerDetected(true);
          setStatus("");
          setError("");
        };
        peer.onicecandidate = ({ candidate }) => {
          if (candidate && socketRef.current?.readyState === WebSocket.OPEN) {
            log("Sending ICE candidate", candidate.candidate);
            socketRef.current.send(
              JSON.stringify({ type: "ice_candidate", candidate }),
            );
          }
        };
        peer.oniceconnectionstatechange = () =>
          log("ICE state changed", peer.iceConnectionState);
        peer.onsignalingstatechange = () =>
          log("Signaling state changed", peer.signalingState);
        peer.onconnectionstatechange = () => {
          log("Connection state changed", peer.connectionState);
          if (peer.connectionState === "connected") {
            clearTimeout(reconnectTimerRef.current);
            reconnectAttemptsRef.current = 0;
            setPeerDetected(true);
            setError("");
            setStatus("");
          }
          if (peer.connectionState === "failed")
            setError(
              "The peer connection failed. Check the network and ask your partner to rejoin.",
            );
          if (peer.connectionState === "disconnected") {
            setStatus("Connection interrupted. Reconnecting…");
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = setTimeout(() => {
              if (
                peerRef.current === peer &&
                peer.connectionState === "disconnected" &&
                initiatorRef.current
              ) {
                reconnectAttemptsRef.current += 1;
                log("Requesting ICE restart", reconnectAttemptsRef.current);
                if (typeof peer.restartIce === "function") {
                  iceRestartRequestedRef.current = true;
                  peer.restartIce();
                } else
                  setError(
                    "This browser cannot restart ICE. Refresh the meeting to reconnect.",
                  );
              }
            }, 3000);
          }
          if (peer.connectionState === "closed" && !leavingRef.current)
            setStatus("Waiting for another participant...");
        };
        peer.onnegotiationneeded = async () => {
          // Only the server-selected initiator is permitted to generate offers.
          if (
            !initiatorRef.current ||
            makingOfferRef.current ||
            (offerSentRef.current && !iceRestartRequestedRef.current)
          )
            return;
          if (
            peer.signalingState !== "stable" ||
            socketRef.current?.readyState !== WebSocket.OPEN
          )
            return;
          try {
            makingOfferRef.current = true;
            const restartingIce = iceRestartRequestedRef.current;
            const offer = await peer.createOffer(
              restartingIce ? { iceRestart: true } : undefined,
            );
            await peer.setLocalDescription(offer);
            socketRef.current.send(
              JSON.stringify({ type: "offer", offer: peer.localDescription }),
            );
            offerSentRef.current = true;
            iceRestartRequestedRef.current = false;
            log(
              restartingIce ? "Sent ICE-restart SDP offer" : "Sent SDP offer",
            );
          } catch (offerError) {
            console.error(`[WebRTC ${code}] Offer failed`, offerError);
            setError(`Could not create the call offer: ${offerError.message}`);
          } finally {
            makingOfferRef.current = false;
          }
        };
      } catch (peerError) {
        console.error(`[WebRTC ${code}] Peer setup failed`, peerError);
        setError(`Could not prepare the peer connection: ${peerError.message}`);
        return null;
      }
    }
    return peer;
  }, [code, log, startLocalMedia]);

  useEffect(() => {
    let disposed = false;
    const connect = async () => {
      try {
        const { data } = await api.get(`rooms/${code}/`);
        if (disposed) return;
        setRoom(data);
        setMessages(data.messages || []);
        const protocol = window.location.protocol === "https:" ? "wss" : "ws";
        const token = encodeURIComponent(localStorage.getItem("token") || "");
        // Start permission/device setup before signaling, so tracks exist when an offer arrives.
        await startLocalMedia();
        if (disposed) return;
        const socket = new WebSocket(
          `${protocol}://${window.location.hostname || "localhost"}:8000/ws/meeting/${code}/?token=${token}`,
        );
        socketRef.current = socket;
        socket.onopen = () => {
          log("Signaling WebSocket open");
          if (!disposed) socket.send(JSON.stringify({ type: "join" }));
        };
        socket.onerror = (socketError) => {
          console.error(
            `[WebRTC ${code}] Signaling WebSocket error`,
            socketError,
          );
          if (!disposed)
            setError("The meeting WebSocket could not be established.");
        };
        socket.onclose = (event) => {
          log("Signaling WebSocket closed", {
            code: event.code,
            reason: event.reason,
          });
          if (!disposed && !leavingRef.current)
            setError(
              event.code === 4403
                ? "You are not authorized to join this room."
                : "Meeting connection closed. Refresh to reconnect.",
            );
        };
        socket.onmessage = async ({ data: raw }) => {
          try {
            const event = JSON.parse(raw);
            if (event.type === "peer_joined") {
              initiatorRef.current = Boolean(event.initiator);

              setStatus("Connecting...");
              // Do NOT call setPeerDetected(true) here.

              log("Peer joined", { initiator: initiatorRef.current });

              const peer = await ensurePeerConnection();

              if (
                initiatorRef.current &&
                peer &&
                !offerSentRef.current &&
                peer.signalingState === "stable"
              ) {
                peer.dispatchEvent(new Event("negotiationneeded"));
              }
            } else if (event.type === "offer") {
              const peer = await ensurePeerConnection();
              if (!peer) return;
              if (peer.signalingState !== "stable") {
                log("Ignoring duplicate offer", peer.signalingState);
                return;
              }
              log("Received SDP offer");
              await peer.setRemoteDescription(event.offer);
              await flushPendingCandidates(peer);
              const answer = await peer.createAnswer();
              await peer.setLocalDescription(answer);
              socket.send(
                JSON.stringify({
                  type: "answer",
                  answer: peer.localDescription,
                }),
              );
              log("Sent SDP answer");
              setStatus("Connecting to your peer...");
            } else if (event.type === "answer") {
              const peer = peerRef.current;
              if (!peer || peer.signalingState !== "have-local-offer") {
                log("Ignoring unexpected answer", peer?.signalingState);
                return;
              }
              log("Received SDP answer");
              await peer.setRemoteDescription(event.answer);
              await flushPendingCandidates(peer);
            } else if (event.type === "ice_candidate" && event.candidate) {
              const peer = peerRef.current;
              if (!peer || !peer.remoteDescription?.type) {
                pendingCandidatesRef.current.push(event.candidate);
                log(
                  "Queued ICE candidate",
                  pendingCandidatesRef.current.length,
                );
                return;
              }
              await peer.addIceCandidate(event.candidate);
              log("Added ICE candidate");
            } else if (event.type === "chat") {
              setMessages((current) => [...current, event]);
            } else if (event.type === "leave") {
              setPeerDetected(false);
              setStatus(
                "Your participant left. Waiting for another participant...",
              );
              setStatus("Waiting for another participant...");
              if (remoteVideo.current) remoteVideo.current.srcObject = null;
              peerRef.current?.close();
              peerRef.current = null;
              pendingCandidatesRef.current = [];
              offerSentRef.current = false;
              makingOfferRef.current = false;
              initiatorRef.current = false;
              iceRestartRequestedRef.current = false;
            }
          } catch (signalError) {
            setError(`Meeting signaling error: ${signalError.message}`);
          }
        };
      } catch (requestError) {
        setError(errorText(requestError));
      }
    };
    connect();
    return () => {
      disposed = true;
      cleanup(false);
    };
  }, [
    code,
    cleanup,
    ensurePeerConnection,
    flushPendingCandidates,
    log,
    startLocalMedia,
  ]);
  const toggleTrack = (kind) => {
    const track = streamRef.current
      ?.getTracks()
      .find((item) => item.kind === kind);
    if (!track) return;
    track.enabled = !track.enabled;
    kind === "video" ? setCameraOn(track.enabled) : setMicOn(track.enabled);
  };
  const sendChat = (event) => {
    event.preventDefault();
    const message = text.trim();
    if (!message || socketRef.current?.readyState !== WebSocket.OPEN) return;
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    socketRef.current.send(JSON.stringify({ type: "chat", message }));
    setMessages((current) => [
      ...current,
      {
        message,
        sender: user.name || "You",
        sender_id: user.id,
        timestamp: new Date().toISOString(),
      },
    ]);
    setText("");
  };
  const loadQuestions = async () => {
    try {
      setError("");
      setQuestions([]);
      setAnswers([]);

      const { data } = await api.post("ai/questions/", {
        role: room.role,
      });

      setQuestions(data.questions || []);
    } catch (requestError) {
      setError(errorText(requestError));
    }
  };

  const loadAnswers = async () => {
    try {
      setError("");

      const { data } = await api.post("ai/answers/", {
        role: room.role,
        questions: questions.map((q) => q.question),
      });

      setAnswers(data.answers || []);
    } catch (requestError) {
      setError(errorText(requestError));
    }
  };
  const leave = () => {
    leavingRef.current = true;
    cleanup(true);
    navigate("/");
  };

  if (!room) return <main className="loading">Loading your private room…</main>;
  return (
    <main className="meeting-shell">
      <header className="meeting-header">
        <div className="meeting-identity">
          <span className="brand">
            vibe<span>link</span>
          </span>
          <span className="meeting-divider" />
          <div>
            <strong>{room.role}</strong>
            <p>Private two-person room</p>
          </div>
        </div>
        <span className="security-badge">
          <ShieldCheck size={14} /> Secure WebRTC connection
        </span>
        <button className="header-leave" onClick={leave}>
          <PhoneOff size={18} /> Leave meeting
        </button>
      </header>
      {error && <div className="meeting-notice">{error}</div>}
      <section className="meeting-workspace">
        <section className="meeting-stage">
          <div className="meeting-remote">
            <video ref={remoteVideo} autoPlay playsInline />
            {!peerDetected && (
              <div className="meeting-overlay">
                <span className="spinner small" />
                <p>{status}</p>
                <small>Searching... Please wait.</small>
              </div>
            )}
          </div>
          <div className="meeting-local">
            <video ref={localVideo} autoPlay muted playsInline />
            <b>You</b>
          </div>
          <div className="meeting-controls">
            <button
              aria-label="Toggle microphone"
              onClick={() => toggleTrack("audio")}
              disabled={!streamRef.current}
            >
              {micOn ? <Mic /> : <MicOff />}
            </button>
            <button
              aria-label="Toggle camera"
              onClick={() => toggleTrack("video")}
              disabled={!streamRef.current}
            >
              {cameraOn ? <Video /> : <VideoOff />}
            </button>
            <button
              className="control-leave"
              aria-label="Leave meeting"
              onClick={leave}
            >
              <PhoneOff />
            </button>
          </div>
        </section>
        <aside className="meeting-sidebar">
          <section className="assistant-card">
            <p className="assistant-label">
              <Sparkles size={15} /> AI INTERVIEW ASSISTANT
            </p>
            <h2>{room.role}</h2>
            <p className="assistant-copy">
              Generate role-specific interview questions and AI-powered answers.
            </p>
            <div className="assistant-actions">
              <button onClick={loadQuestions}>
                <ListChecks size={14} />
                Generate Questions
              </button>

              <button onClick={loadAnswers} disabled={!questions.length}>
                <FileText size={14} />
                Generate Answers
              </button>
            </div>
          </section>
          <section className="questions-card">
            <div className="questions-heading">
              <h3>Interview questions</h3>
              <span>{questions.length}</span>
            </div>
            <div className="question-list">
              {questions.map((question, index) => (
                <article className="question" key={question.question}>
                  <b>
                    <span>{index + 1}</span>
                    {question.question}
                  </b>
                  {answers[index] && (
                    <p>
                      <strong>Answer:</strong> {answers[index]}
                    </p>
                  )}
                </article>
              ))}
            </div>
          </section>
        </aside>
        <section className="meeting-chat">
          <div className="chat-heading">
            <h3>
              <MessageCircle size={17} /> Room chat
            </h3>
            <span>{peerDetected ? "Live" : "Waiting"}</span>
          </div>
          <div className="chat-list">
            {messages.map((message, index) => (
              <p
                className={
                  message.sender_id ===
                  JSON.parse(localStorage.getItem("user") || "{}").id
                    ? "mine"
                    : ""
                }
                key={`${message.timestamp}-${index}`}
              >
                <b>{message.sender}</b>
                {message.message}
                <small>
                  {new Date(message.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </small>
              </p>
            ))}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={sendChat}>
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength="1000"
              placeholder="Write a message…"
            />
            <button aria-label="Send message">
              <ArrowRight size={17} />
            </button>
          </form>
        </section>
      </section>
    </main>
  );
}
