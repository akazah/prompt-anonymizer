import os
import openai

from config.constants import OPENAI_MODEL

class OpenAIHandler:
    def __init__(self):
        openai.api_key = os.getenv("OPENAI_API_KEY")

    def chat_completion(self, prompt):
        response = openai.ChatCompletion.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "user", "content": prompt}
            ])
        return response["choices"][0]["message"]["content"]
    
