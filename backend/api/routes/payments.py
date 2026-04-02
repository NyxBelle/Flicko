import hmac
import hashlib
import requests
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from api.dependencies import get_db, get_current_user
from models.user import User
from models.credit import Credit
from config import settings

router = APIRouter()

PAYSTACK_BASE = "https://api.paystack.co"
FLUTTERWAVE_BASE = "https://api.flutterwave.com/v3"


# ═══════════════════════════════════════════════════════════
# PAYSTACK
# ═══════════════════════════════════════════════════════════

@router.post("/paystack/initiate")
def initiate_paystack(
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    """Frontend calls this when user clicks Upgrade via Paystack."""
    response = requests.post(
        f"{PAYSTACK_BASE}/transaction/initialize",
        headers={
            "Authorization": f"Bearer {settings.PAYSTACK_SECRET_KEY}",
            "Content-Type": "application/json"
        },
        json={
            "email": user.email,
            "amount": 1500000,
            "currency": "USD",
            "metadata": {
                "user_id": user.id,
                "plan": "pro"
            },
            "callback_url": f"{settings.FRONTEND_URL}/payment/success?provider=paystack"
        }
    )
    response.raise_for_status()
    data = response.json()
    return {
        "payment_url": data["data"]["authorization_url"],
        "reference": data["data"]["reference"],
        "provider": "paystack"
    }


@router.post("/paystack/webhook")
async def paystack_webhook(request: Request, db: Session = Depends(get_db)):
    """Paystack calls this automatically when payment succeeds."""
    payload = await request.body()
    signature = request.headers.get("x-paystack-signature")

    expected = hmac.new(
        settings.PAYSTACK_SECRET_KEY.encode(),
        payload,
        hashlib.sha512
    ).hexdigest()

    if signature != expected:
        raise HTTPException(400, "Invalid webhook signature")

    data = await request.json()

    if data.get("event") != "charge.success":
        return {"status": "ignored"}

    user_id = data["data"]["metadata"].get("user_id")
    return _upgrade_user(db, user_id)


@router.get("/paystack/verify/{reference}")
def verify_paystack(
    reference: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    """Frontend calls this on success page to confirm payment."""
    response = requests.get(
        f"{PAYSTACK_BASE}/transaction/verify/{reference}",
        headers={"Authorization": f"Bearer {settings.PAYSTACK_SECRET_KEY}"}
    )
    response.raise_for_status()
    data = response.json()

    if data["data"]["status"] == "success":
        return {
            "status": "success",
            "plan": user.plan,
            "message": "Payment verified. You are now on Pro!"
        }
    return {"status": "pending"}


# ═══════════════════════════════════════════════════════════
# FLUTTERWAVE
# ═══════════════════════════════════════════════════════════

@router.post("/flutterwave/initiate")
def initiate_flutterwave(
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    """Frontend calls this when user clicks Upgrade via Flutterwave."""
    response = requests.post(
        f"{FLUTTERWAVE_BASE}/payments",
        headers={
            "Authorization": f"Bearer {settings.FLUTTERWAVE_SECRET_KEY}",
            "Content-Type": "application/json"
        },
        json={
            "tx_ref": f"flicko-{user.id}-{datetime.utcnow().timestamp()}",
            "amount": 15,
            "currency": "USD",
            "redirect_url": f"{settings.FRONTEND_URL}/payment/success?provider=flutterwave",
            "customer": {
                "email": user.email,
            },
            "meta": {
                "user_id": user.id,
                "plan": "pro"
            },
            "customizations": {
                "title": "Flicko Pro",
                "description": "Upgrade to Flicko Pro - $15/month",
                "logo": f"{settings.FRONTEND_URL}/logo.png"
            }
        }
    )
    response.raise_for_status()
    data = response.json()
    return {
        "payment_url": data["data"]["link"],
        "provider": "flutterwave"
    }


@router.post("/flutterwave/webhook")
async def flutterwave_webhook(request: Request, db: Session = Depends(get_db)):
    """Flutterwave calls this automatically when payment succeeds."""
    # Verify webhook signature
    signature = request.headers.get("verif-hash")
    if signature != settings.FLUTTERWAVE_WEBHOOK_SECRET:
        raise HTTPException(400, "Invalid webhook signature")

    data = await request.json()

    if data.get("event") != "charge.completed":
        return {"status": "ignored"}

    if data["data"]["status"] != "successful":
        return {"status": "ignored"}

    user_id = data["data"]["meta"].get("user_id")
    return _upgrade_user(db, user_id)


@router.get("/flutterwave/verify/{transaction_id}")
def verify_flutterwave(
    transaction_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    """Frontend calls this on success page to confirm payment."""
    response = requests.get(
        f"{FLUTTERWAVE_BASE}/transactions/{transaction_id}/verify",
        headers={"Authorization": f"Bearer {settings.FLUTTERWAVE_SECRET_KEY}"}
    )
    response.raise_for_status()
    data = response.json()

    if data["data"]["status"] == "successful":
        return {
            "status": "success",
            "plan": user.plan,
            "message": "Payment verified. You are now on Pro!"
        }
    return {"status": "pending"}


# ═══════════════════════════════════════════════════════════
# SHARED HELPER
# ═══════════════════════════════════════════════════════════

def _upgrade_user(db: Session, user_id: str) -> dict:
    """Shared logic to upgrade a user to Pro after successful payment."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")

    user.plan = "pro"
    user.plan_expires = datetime.utcnow() + timedelta(days=30)

    credit = db.query(Credit).filter(Credit.user_id == user.id).first()
    if credit:
        credit.balance = 100
        credit.last_reset = datetime.utcnow()
    else:
        credit = Credit(user_id=user.id, balance=100)
        db.add(credit)

    db.commit()
    return {"status": "success", "message": "User upgraded to Pro"}