from celery.schedules import crontab
from workers.celery_app import celery_app
from models.database import SessionLocal
from models.credit import Credit
from models.user import User

# Tell Celery to run reset_daily_credits every day at midnight UTC
celery_app.conf.beat_schedule = {
    "reset-credits-midnight": {
        "task": "workers.scheduler.reset_daily_credits",
        "schedule": crontab(hour=0, minute=0),    # midnight UTC every day
    }
}


@celery_app.task
def reset_daily_credits():
    """
    Runs every midnight. Resets all users' credits based on their plan.
    Free users get 5, Pro users get 100.
    """
    db = SessionLocal()
    try:
        users = db.query(User).all()
        for user in users:
            credit = db.query(Credit).filter(Credit.user_id == user.id).first()

            # Check if Pro plan has expired
            if user.plan == "pro" and user.plan_expires:
                from datetime import datetime
                if datetime.utcnow() > user.plan_expires:
                    user.plan = "free"

            daily_limit = 100 if user.plan == "pro" else 5

            if credit:
                credit.balance = daily_limit
            else:
                credit = Credit(user_id=user.id, balance=daily_limit)
                db.add(credit)

        db.commit()
        return f"Reset credits for {len(users)} users"

    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()