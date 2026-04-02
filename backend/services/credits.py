from sqlalchemy.orm import Session
from datetime import datetime, date
from models.credit import Credit
from models.user import User

FREE_DAILY_CREDITS = 5
PRO_DAILY_CREDITS = 100


def get_or_create_credits(db: Session, user: User) -> Credit:
    """Get user's credit record, creating it if it doesn't exist."""
    credit = db.query(Credit).filter(Credit.user_id == user.id).first()

    if not credit:
        # First time — create credit record
        balance = PRO_DAILY_CREDITS if user.plan == "pro" else FREE_DAILY_CREDITS
        credit = Credit(user_id=user.id, balance=balance)
        db.add(credit)
        db.commit()
        db.refresh(credit)

    return credit


def reset_if_new_day(db: Session, credit: Credit, user: User) -> Credit:
    """Reset credits if it's a new day."""
    today = date.today()
    last_reset_date = credit.last_reset.date() if credit.last_reset else None

    if last_reset_date != today:
        credit.balance = PRO_DAILY_CREDITS if user.plan == "pro" else FREE_DAILY_CREDITS
        credit.last_reset = datetime.utcnow()
        db.commit()
        db.refresh(credit)

    return credit


def check_and_deduct_credit(db: Session, user: User) -> dict:
    """
    Check if user has credits and deduct one.
    Returns: { "success": bool, "balance": int, "message": str }
    """
    credit = get_or_create_credits(db, user)
    credit = reset_if_new_day(db, credit, user)

    if credit.balance <= 0:
        return {
            "success": False,
            "balance": 0,
            "message": "No credits remaining. Credits reset at midnight."
        }

    credit.balance -= 1
    db.commit()

    return {
        "success": True,
        "balance": credit.balance,
        "message": f"{credit.balance} credits remaining today."
    }


def get_balance(db: Session, user: User) -> dict:
    """Get current credit balance for a user."""
    credit = get_or_create_credits(db, user)
    credit = reset_if_new_day(db, credit, user)

    return {
        "balance": credit.balance,
        "plan": user.plan,
        "daily_limit": PRO_DAILY_CREDITS if user.plan == "pro" else FREE_DAILY_CREDITS
    }