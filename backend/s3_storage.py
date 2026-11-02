import os
import time
import logging
from typing import Optional, Dict, Any
from pathlib import Path

logger = logging.getLogger("clipforge.s3")

# Optional boto3 import so local development without AWS still runs cleanly
try:
    import boto3
    from botocore.config import Config
    BOTO3_AVAILABLE = True
except ImportError:
    BOTO3_AVAILABLE = False


class S3StorageService:
    def __init__(self):
        self.bucket_name = os.getenv("AWS_S3_BUCKET_NAME", "")
        self.region = os.getenv("AWS_REGION", "us-east-1")
        self.access_key = os.getenv("AWS_ACCESS_KEY_ID", "")
        self.secret_key = os.getenv("AWS_SECRET_ACCESS_KEY", "")
        self.endpoint_url = os.getenv("AWS_S3_ENDPOINT_URL", None)  # Supports Cloudflare R2 / MinIO / LocalStack
        
        self.enabled = bool(self.bucket_name and self.access_key and self.secret_key and BOTO3_AVAILABLE)
        self._client = None

    def _get_client(self):
        if not self.enabled:
            return None
        if self._client is None:
            self._client = boto3.client(
                "s3",
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key,
                region_name=self.region,
                endpoint_url=self.endpoint_url,
                config=Config(signature_version="s3v4")
            )
        return self._client

    def generate_presigned_upload_url(
        self,
        filename: str,
        content_type: str = "video/mp4",
        expires_in: int = 900
    ) -> Dict[str, Any]:
        """
        Generates an S3 Pre-signed URL for direct client-to-S3 HTTP PUT uploads.
        Bypasses Vercel's 4.5MB Serverless function payload limit.
        """
        if not self.enabled:
            raise RuntimeError(
                "AWS S3 is not configured. Set AWS_S3_BUCKET_NAME, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY."
            )

        client = self._get_client()
        ext = Path(filename).suffix.lower() or ".mp4"
        clean_stem = "".join(c for c in Path(filename).stem if c.isalnum() or c in ("-", "_"))[:30]
        object_key = f"uploads/{int(time.time())}_{clean_stem}{ext}"

        presigned_url = client.generate_presigned_url(
            ClientMethod="put_object",
            Params={
                "Bucket": self.bucket_name,
                "Key": object_key,
                "ContentType": content_type,
            },
            ExpiresIn=expires_in,
        )

        return {
            "upload_url": presigned_url,
            "object_key": object_key,
            "bucket": self.bucket_name,
            "expires_in": expires_in,
            "content_type": content_type
        }

    def download_file(self, object_key: str, local_destination: Path) -> Path:
        """Downloads an S3 object to local worker filesystem for FFmpeg processing."""
        if not self.enabled:
            raise RuntimeError("S3 storage is not configured.")
        client = self._get_client()
        local_destination.parent.mkdir(parents=True, exist_ok=True)
        client.download_file(self.bucket_name, object_key, str(local_destination))
        return local_destination

    def upload_file(self, local_path: Path, object_key: str, content_type: str = "video/mp4") -> str:
        """Uploads processed short clips / ZIP packages to S3."""
        if not self.enabled:
            return str(local_path)
        client = self._get_client()
        client.upload_file(
            str(local_path),
            self.bucket_name,
            object_key,
            ExtraArgs={"ContentType": content_type}
        )
        return f"https://{self.bucket_name}.s3.{self.region}.amazonaws.com/{object_key}"


s3_storage = S3StorageService()

