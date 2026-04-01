import boto3
from botocore.config import Config
from config import settings

r2_client = boto3.client(
    "s3",
    endpoint_url=settings.R2_ENDPOINT_URL,
    aws_access_key_id=settings.R2_ACCESS_KEY_ID,
    aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
    config=Config(signature_version="s3v4"),
    region_name="auto"
)

BUCKET = settings.R2_BUCKET_NAME

def upload_file(local_path: str, key: str) -> str:
    r2_client.upload_file(local_path, BUCKET, key)
    return key

def download_file(key: str, local_path: str):
    r2_client.download_file(BUCKET, key, local_path)

def get_presigned_url(key: str, expires: int = 3600) -> str:
    return r2_client.generate_presigned_url(
        "get_object",
        Params={"Bucket": BUCKET, "Key": key},
        ExpiresIn=expires
    )