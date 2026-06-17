import httpx

def test_root():
    url = "http://localhost:8000/"
    print("Calling root endpoint of backend...")
    try:
        r = httpx.get(url, timeout=5.0)
        print(f"Status Code: {r.status_code}")
        print("Response:")
        print(r.text)
    except Exception as e:
        print(f"Failed: {e}")

if __name__ == "__main__":
    test_root()
