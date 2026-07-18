import re
from google import genai
from django.conf import settings

client = genai.Client(api_key=settings.GEMINI_API_KEY)


def generate_questions(role):
    prompt = f"""
Generate exactly 5 technical interview questions for a {role}.

Rules:
- Fresher level
- Technical questions only
- No explanations
- Return only numbered questions.
"""

    response = client.models.generate_content(
        model="gemini-flash-lite-latest",
        contents=prompt,
    )

    text = response.text or ""

    questions = []

    for line in text.splitlines():
        line = line.strip()

        if not line:
            continue

        line = re.sub(r"^\d+[\.\)]\s*", "", line)

        if line:
            questions.append(line)

    return questions[:5]


def generate_answers(role, questions):
    prompt = f"""
You are a senior {role} interviewer.

Give a concise answer for each question.

Return exactly one answer per question.

Questions:

"""

    for i, q in enumerate(questions, 1):
        prompt += f"{i}. {q}\n"

    response = client.models.generate_content(
        model="gemini-flash-lite-latest",
        contents=prompt,
    )

    text = response.text or ""

    answers = []

    parts = re.split(r"\n\s*\d+[\.\)]\s*", text)

    for part in parts:
        part = part.strip()
        if part:
            answers.append(part)

    if not answers:
        answers = [text]

    return answers