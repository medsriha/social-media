from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import create_engine, Column, Integer, String, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from typing import List, Optional
import os
import json
import shutil
from datetime import datetime
from pydantic import BaseModel

# Database setup
DATABASE_URL = "sqlite:///./social_media.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Create directories for media storage
MEDIA_DIR = "media"
os.makedirs(MEDIA_DIR, exist_ok=True)

# Database Models
class MediaPost(Base):
    __tablename__ = "media_posts"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, unique=True, index=True)
    original_filename = Column(String)
    media_type = Column(String)  # 'photo' or 'video'
    caption = Column(Text, nullable=True)
    emojis = Column(Text, nullable=True)  # JSON string
    timestamp = Column(Integer)
    published = Column(Boolean, default=True)
    file_path = Column(String)

# Create tables
Base.metadata.create_all(bind=engine)

# Pydantic models for API
class MediaPostResponse(BaseModel):
    id: int
    filename: str
    media_type: str
    caption: Optional[str]
    emojis: Optional[str]
    timestamp: int
    published: bool
    url: str

    class Config:
        from_attributes = True

class MediaPostCreate(BaseModel):
    media_type: str
    caption: Optional[str] = ""
    emojis: Optional[str] = "[]"
    published: bool = True

# FastAPI app
app = FastAPI(title="Social Media API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/media", StaticFiles(directory=MEDIA_DIR), name="media")

# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Routes
@app.get("/")
def read_root():
    return {"message": "Social Media API is running", "version": "1.0.0"}

@app.post("/api/media", response_model=MediaPostResponse)
async def upload_media(
    file: UploadFile = File(...),
    media_type: str = Form(...),
    caption: str = Form(""),
    emojis: str = Form("[]"),
    published: bool = Form(True),
):
    """
    Upload a media file (photo or video) to the server.
    
    IMPORTANT: This endpoint should only be called when the user
    wants to make media PUBLIC. Private media should stay on the
    user's device and NOT be uploaded to the backend.
    
    The 'published' field should always be True when calling this endpoint.
    """
    db = SessionLocal()
    try:
        # Validate media type
        if media_type not in ["photo", "video"]:
            raise HTTPException(status_code=400, detail="Invalid media type")

        # Generate unique filename
        timestamp = int(datetime.now().timestamp() * 1000)
        file_extension = os.path.splitext(file.filename)[1]
        unique_filename = f"{media_type}_{timestamp}{file_extension}"
        file_path = os.path.join(MEDIA_DIR, unique_filename)

        # Save file to disk
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Create database entry
        media_post = MediaPost(
            filename=unique_filename,
            original_filename=file.filename,
            media_type=media_type,
            caption=caption,
            emojis=emojis,
            timestamp=timestamp,
            published=published,
            file_path=file_path,
        )
        db.add(media_post)
        db.commit()
        db.refresh(media_post)

        return MediaPostResponse(
            id=media_post.id,
            filename=media_post.filename,
            media_type=media_post.media_type,
            caption=media_post.caption,
            emojis=media_post.emojis,
            timestamp=media_post.timestamp,
            published=media_post.published,
            url=f"/media/{unique_filename}",
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

@app.get("/api/media", response_model=List[MediaPostResponse])
async def get_all_media(skip: int = 0, limit: int = 100):
    """
    Get all PUBLISHED media posts only.
    
    IMPORTANT: This endpoint only returns media where published=True.
    Private media (saved to user's device) is NOT stored in the database
    and will not be returned by this endpoint.
    
    Only media that users explicitly made public appears in the feed.
    """
    db = SessionLocal()
    try:
        # Only fetch PUBLISHED media (published=True)
        # Private media stays on user's device and is not in the database
        media_posts = (
            db.query(MediaPost)
            .filter(MediaPost.published == True)  # CRITICAL: Only public media
            .order_by(MediaPost.timestamp.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

        return [
            MediaPostResponse(
                id=post.id,
                filename=post.filename,
                media_type=post.media_type,
                caption=post.caption,
                emojis=post.emojis,
                timestamp=post.timestamp,
                published=post.published,
                url=f"/media/{post.filename}",
            )
            for post in media_posts
        ]
    finally:
        db.close()

@app.get("/api/media/{media_id}", response_model=MediaPostResponse)
async def get_media_by_id(media_id: int):
    """
    Get a specific media post by ID
    """
    db = SessionLocal()
    try:
        media_post = db.query(MediaPost).filter(MediaPost.id == media_id).first()
        if not media_post:
            raise HTTPException(status_code=404, detail="Media not found")

        return MediaPostResponse(
            id=media_post.id,
            filename=media_post.filename,
            media_type=media_post.media_type,
            caption=media_post.caption,
            emojis=media_post.emojis,
            timestamp=media_post.timestamp,
            published=media_post.published,
            url=f"/media/{media_post.filename}",
        )
    finally:
        db.close()

@app.delete("/api/media/{media_id}")
async def delete_media(media_id: int):
    """
    Delete a media post
    """
    db = SessionLocal()
    try:
        media_post = db.query(MediaPost).filter(MediaPost.id == media_id).first()
        if not media_post:
            raise HTTPException(status_code=404, detail="Media not found")

        # Delete file from disk
        if os.path.exists(media_post.file_path):
            os.remove(media_post.file_path)

        # Delete database entry
        db.delete(media_post)
        db.commit()

        return {"message": "Media deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

