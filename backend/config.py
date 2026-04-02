from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    REDIS_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080

    ANTHROPIC_API_KEY: str
    OPENAI_API_KEY: str = ""
    ELEVENLABS_API_KEY: str

    R2_ENDPOINT_URL: str
    R2_ACCESS_KEY_ID: str
    R2_SECRET_ACCESS_KEY: str
    R2_BUCKET_NAME: str

    PAYSTACK_SECRET_KEY: str = ""
    FLUTTERWAVE_SECRET_KEY: str = ""
    FLUTTERWAVE_WEBHOOK_SECRET: str = ""
    FRONTEND_URL: str = "http://localhost:3000"

    class Config:
        env_file = ".env"

settings = Settings()
```

**Ctrl+S**

---

Now open your `.env` file and add these three new lines at the bottom:
```
FLUTTERWAVE_SECRET_KEY=FLWSECK_TEST-your-flutterwave-secret-key
FLUTTERWAVE_WEBHOOK_SECRET=your-flutterwave-webhook-secret
PAYSTACK_SECRET_KEY=sk_test_your-paystack-secret-key