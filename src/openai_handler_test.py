import os
import openai
import src.openai_handler as openai_handler

def test_chat_completion():
    prompts = ["雨はなぜ降るのですか？","Why rain falls?"]
    for prompt in prompts:
        openai.api_key = os.getenv("OPENAI_API_KEY")
        completion = openai_handler.OpenAIHandler().chat_completion(prompt=prompt)
        assert completion["choices"][0]["message"] != ""
        print("\n-----")
        print("Prompt: "+prompt)
        print("Completion: "+completion["choices"][0]["message"]["content"])
        print("-----")
