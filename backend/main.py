from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
import traceback
from database import get_db, engine, Base
import models
import services
import auth
from routers import admin, employee

from sqlalchemy import text

app = FastAPI(title="ShizenAI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    # Seed default Admin and Employee
    db = next(get_db())
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            conn.commit()
        Base.metadata.create_all(bind=engine)
        
        if not db.query(models.User).filter_by(name="admin").first():
            db.add(models.User(name="admin", role="admin", hashed_password=auth.get_password_hash("admin")))
        if not db.query(models.User).filter_by(name="employee").first():
            db.add(models.User(name="employee", role="employee", hashed_password=auth.get_password_hash("employee")))
        db.commit()
    except Exception as e:
        print("Seeding failed:", str(e))

@app.post("/api/v1/auth/token")
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.name == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": str(user.id), "role": user.role}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer", "role": user.role, "name": user.name}

app.include_router(admin.router)
app.include_router(employee.router)

