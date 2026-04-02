from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from api.dependencies import get_db, get_current_user
from services.credits import get_balance

router = APIRouter()

@router.get("/balance")
def get_credit_balance(
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    """Frontend calls this to show credits remaining badge."""
    return get_balance(db, user)