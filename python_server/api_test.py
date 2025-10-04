import requests
import json

BASE_URL = "http://localhost:5000"

def test_health_check():
    response = requests.get(f"{BASE_URL}/api/health")
    print("Health Check:", response.json())

def test_chat():
    print("\n--- Testing Chat Endpoint ---")
    headers = {"Authorization": "Bearer 123"}
    data = {"question": "What is RAG?"}
    response = requests.post(f"{BASE_URL}/api/chat", headers=headers, json=data)
    print("Chat Response:", response.json())

def test_summarize():
    print("\n--- Testing Summarize Endpoint ---")
    headers = {"Authorization": "Bearer 123"}
    response = requests.post(f"{BASE_URL}/api/summarize", headers=headers)
    print("Summarize Response:", response.json())

def test_load_summary():
    print("\n--- Testing Load Summary Endpoint ---")
    headers = {"Authorization": "Bearer 456"}
    data = {"summary": "This is a summary."}
    response = requests.post(f"{BASE_URL}/api/load_summary", headers=headers, json=data)
    print("Load Summary Response:", response.json())

def test_search():
    print("\n--- Testing Search Endpoint ---")
    data = {"query": "RAG", "k": 3}
    response = requests.post(f"{BASE_URL}/api/search", json=data)
    print("Search Response:", response.json())

def test_search_analyze():
    print("\n--- Testing Search Analyze Endpoint ---")
    data = {"query": "RAG", "analyze": True}
    response = requests.post(f"{BASE_URL}/api/search", json=data)
    print("Search Analyze Response:", response.json())

def test_chat_stream():
    print("\n--- Testing Chat Stream Endpoint ---")
    headers = {"Authorization": "Bearer 789"}
    data = {"question": "Explain RAG in simple terms."}
    with requests.post(f"{BASE_URL}/api/chat/stream", headers=headers, json=data, stream=True) as r:
        for chunk in r.iter_lines():
            if chunk:
                decoded_chunk = chunk.decode('utf-8')
                if decoded_chunk.startswith('data:'):
                    try:
                        json_data = json.loads(decoded_chunk[5:])
                        print(json_data)
                    except json.JSONDecodeError:
                        print(f"Received non-JSON data: {decoded_chunk}")

def test_rag_pipeline():
    print("\n--- Testing RAG Pipeline ---")
    headers = {"Authorization": "Bearer 999"}
    data = {"question": "What is the capital of France?"}
    response = requests.post(f"{BASE_URL}/api/chat", headers=headers, json=data)
    response_json = response.json()
    print("RAG Pipeline Response:", response_json)
    assert response.status_code == 200
    assert response_json["success"] == True
    assert "answer" in response_json

if __name__ == "__main__":
    test_health_check()
    test_chat()
    test_summarize()
    test_load_summary()
    test_search()
    test_search_analyze()
    test_rag_pipeline()
    # Uncomment to test streaming
    # test_chat_stream()
