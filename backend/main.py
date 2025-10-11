from fastapi import FastAPI, File, UploadFile, HTTPException, Form, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import create_engine, Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
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
    
    # Relationships
    comments = relationship("Comment", back_populates="media_post", cascade="all, delete-orphan")
    likes = relationship("MediaLike", back_populates="media_post", cascade="all, delete-orphan")

class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Foreign keys
    media_post_id = Column(Integer, ForeignKey("media_posts.id"), nullable=False)
    parent_comment_id = Column(Integer, ForeignKey("comments.id"), nullable=True)
    
    # User information (simplified - in a real app you'd have a User model)
    author_name = Column(String, nullable=False, default="Anonymous")
    
    # Relationships
    media_post = relationship("MediaPost", back_populates="comments")
    parent_comment = relationship("Comment", remote_side=[id], backref="replies")
    likes = relationship("CommentLike", back_populates="comment", cascade="all, delete-orphan")

class CommentLike(Base):
    __tablename__ = "comment_likes"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Foreign keys
    comment_id = Column(Integer, ForeignKey("comments.id"), nullable=False)
    
    # User information (simplified - in a real app you'd have a User model)
    user_name = Column(String, nullable=False, default="Anonymous")
    
    # Relationships
    comment = relationship("Comment", back_populates="likes")

class MediaLike(Base):
    __tablename__ = "media_likes"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Foreign keys
    media_post_id = Column(Integer, ForeignKey("media_posts.id"), nullable=False)
    
    # User information (simplified - in a real app you'd have a User model)
    user_name = Column(String, nullable=False, default="Anonymous")
    
    # Relationships
    media_post = relationship("MediaPost", back_populates="likes")

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
    likes_count: int = 0

    class Config:
        from_attributes = True

class MediaPostCreate(BaseModel):
    media_type: str
    caption: Optional[str] = ""
    emojis: Optional[str] = "[]"
    published: bool = True

# Comment Pydantic models
class CommentCreate(BaseModel):
    content: str
    author_name: str = "Anonymous"
    parent_comment_id: Optional[int] = None

class CommentUpdate(BaseModel):
    content: str

class CommentLikeResponse(BaseModel):
    id: int
    user_name: str
    created_at: datetime

    class Config:
        from_attributes = True

class CommentResponse(BaseModel):
    id: int
    content: str
    author_name: str
    created_at: datetime
    updated_at: datetime
    media_post_id: int
    parent_comment_id: Optional[int]
    likes_count: int
    replies_count: int
    likes: List[CommentLikeResponse] = []

    class Config:
        from_attributes = True

class CommentWithRepliesResponse(BaseModel):
    id: int
    content: str
    author_name: str
    created_at: datetime
    updated_at: datetime
    media_post_id: int
    parent_comment_id: Optional[int]
    likes_count: int
    replies_count: int
    likes: List[CommentLikeResponse] = []
    replies: List["CommentResponse"] = []

    class Config:
        from_attributes = True

class CommentLikeCreate(BaseModel):
    user_name: str = "Anonymous"

# Media Like Pydantic models
class MediaLikeResponse(BaseModel):
    id: int
    user_name: str
    created_at: datetime

    class Config:
        from_attributes = True

class MediaLikeCreate(BaseModel):
    user_name: str = "Anonymous"

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

# Custom video streaming endpoint with range request support
@app.get("/media/{filename}")
async def serve_media(filename: str, request: Request):
    """
    Serve media files with proper video streaming support (HTTP range requests)
    """
    file_path = os.path.join(MEDIA_DIR, filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Media not found")
    
    file_size = os.path.getsize(file_path)
    
    # Check if this is a video file
    is_video = filename.lower().endswith(('.mp4', '.mov', '.avi', '.mkv', '.webm'))
    
    # Get range header for video streaming
    range_header = request.headers.get("range")
    
    if is_video and range_header:
        # Parse range header (format: "bytes=start-end")
        range_match = range_header.replace("bytes=", "").split("-")
        start = int(range_match[0]) if range_match[0] else 0
        end = int(range_match[1]) if len(range_match) > 1 and range_match[1] else file_size - 1
        
        # Ensure end doesn't exceed file size
        end = min(end, file_size - 1)
        chunk_size = end - start + 1
        
        # Read the requested chunk
        def iter_file():
            with open(file_path, "rb") as f:
                f.seek(start)
                remaining = chunk_size
                while remaining:
                    chunk = f.read(min(8192, remaining))
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    yield chunk
        
        # Determine content type
        content_type = "video/quicktime" if filename.endswith('.mov') else "video/mp4"
        
        headers = {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(chunk_size),
            "Content-Type": content_type,
        }
        
        return StreamingResponse(iter_file(), status_code=206, headers=headers)
    else:
        # For images or full file requests, return the whole file
        media_type = None
        if filename.endswith('.jpg') or filename.endswith('.jpeg'):
            media_type = "image/jpeg"
        elif filename.endswith('.png'):
            media_type = "image/png"
        elif filename.endswith('.mov'):
            media_type = "video/quicktime"
        elif filename.endswith('.mp4'):
            media_type = "video/mp4"
        
        return FileResponse(file_path, media_type=media_type, headers={"Accept-Ranges": "bytes"})

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

        # Get likes count (should be 0 for new posts)
        likes_count = db.query(MediaLike).filter(MediaLike.media_post_id == media_post.id).count()

        return MediaPostResponse(
            id=media_post.id,
            filename=media_post.filename,
            media_type=media_post.media_type,
            caption=media_post.caption,
            emojis=media_post.emojis,
            timestamp=media_post.timestamp,
            published=media_post.published,
            url=f"/media/{unique_filename}",
            likes_count=likes_count,
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

        result = []
        for post in media_posts:
            # Get likes count for each post
            likes_count = db.query(MediaLike).filter(MediaLike.media_post_id == post.id).count()
            
            result.append(MediaPostResponse(
                id=post.id,
                filename=post.filename,
                media_type=post.media_type,
                caption=post.caption,
                emojis=post.emojis,
                timestamp=post.timestamp,
                published=post.published,
                url=f"/media/{post.filename}",
                likes_count=likes_count,
            ))
        
        return result
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

        # Get likes count
        likes_count = db.query(MediaLike).filter(MediaLike.media_post_id == media_post.id).count()

        return MediaPostResponse(
            id=media_post.id,
            filename=media_post.filename,
            media_type=media_post.media_type,
            caption=media_post.caption,
            emojis=media_post.emojis,
            timestamp=media_post.timestamp,
            published=media_post.published,
            url=f"/media/{media_post.filename}",
            likes_count=likes_count,
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

# Helper function to build comment response with counts
def build_comment_response(comment: Comment, db: Session) -> CommentResponse:
    likes_count = db.query(CommentLike).filter(CommentLike.comment_id == comment.id).count()
    replies_count = db.query(Comment).filter(Comment.parent_comment_id == comment.id).count()
    likes = db.query(CommentLike).filter(CommentLike.comment_id == comment.id).all()
    
    return CommentResponse(
        id=comment.id,
        content=comment.content,
        author_name=comment.author_name,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
        media_post_id=comment.media_post_id,
        parent_comment_id=comment.parent_comment_id,
        likes_count=likes_count,
        replies_count=replies_count,
        likes=[CommentLikeResponse.model_validate(like) for like in likes]
    )

# Comment CRUD endpoints
@app.post("/api/media/{media_id}/comments", response_model=CommentResponse)
async def create_comment(media_id: int, comment_data: CommentCreate, db: Session = Depends(get_db)):
    """
    Create a new comment for a media post
    """
    # Verify media post exists
    media_post = db.query(MediaPost).filter(MediaPost.id == media_id).first()
    if not media_post:
        raise HTTPException(status_code=404, detail="Media post not found")
    
    # If parent_comment_id is provided, verify it exists and belongs to the same media
    if comment_data.parent_comment_id:
        parent_comment = db.query(Comment).filter(
            Comment.id == comment_data.parent_comment_id,
            Comment.media_post_id == media_id
        ).first()
        if not parent_comment:
            raise HTTPException(status_code=404, detail="Parent comment not found or doesn't belong to this media")
    
    # Create comment
    comment = Comment(
        content=comment_data.content,
        author_name=comment_data.author_name,
        media_post_id=media_id,
        parent_comment_id=comment_data.parent_comment_id
    )
    
    db.add(comment)
    db.commit()
    db.refresh(comment)
    
    return build_comment_response(comment, db)

@app.get("/api/media/{media_id}/comments", response_model=List[CommentWithRepliesResponse])
async def get_media_comments(media_id: int, skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    """
    Get all comments for a media post (only top-level comments with their replies)
    """
    # Verify media post exists
    media_post = db.query(MediaPost).filter(MediaPost.id == media_id).first()
    if not media_post:
        raise HTTPException(status_code=404, detail="Media post not found")
    
    # Get top-level comments (no parent)
    top_level_comments = db.query(Comment).filter(
        Comment.media_post_id == media_id,
        Comment.parent_comment_id.is_(None)
    ).order_by(Comment.created_at.desc()).offset(skip).limit(limit).all()
    
    result = []
    for comment in top_level_comments:
        # Get replies for this comment
        replies = db.query(Comment).filter(
            Comment.parent_comment_id == comment.id
        ).order_by(Comment.created_at.asc()).all()
        
        # Build response with reply data
        likes_count = db.query(CommentLike).filter(CommentLike.comment_id == comment.id).count()
        replies_count = len(replies)
        likes = db.query(CommentLike).filter(CommentLike.comment_id == comment.id).all()
        
        replies_response = [build_comment_response(reply, db) for reply in replies]
        
        comment_response = CommentWithRepliesResponse(
            id=comment.id,
            content=comment.content,
            author_name=comment.author_name,
            created_at=comment.created_at,
            updated_at=comment.updated_at,
            media_post_id=comment.media_post_id,
            parent_comment_id=comment.parent_comment_id,
            likes_count=likes_count,
            replies_count=replies_count,
            likes=[CommentLikeResponse.model_validate(like) for like in likes],
            replies=replies_response
        )
        
        result.append(comment_response)
    
    return result

@app.get("/api/comments/{comment_id}", response_model=CommentResponse)
async def get_comment(comment_id: int, db: Session = Depends(get_db)):
    """
    Get a specific comment by ID
    """
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    return build_comment_response(comment, db)

@app.put("/api/comments/{comment_id}", response_model=CommentResponse)
async def update_comment(comment_id: int, comment_data: CommentUpdate, db: Session = Depends(get_db)):
    """
    Update a comment's content
    """
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    comment.content = comment_data.content
    comment.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(comment)
    
    return build_comment_response(comment, db)

@app.delete("/api/comments/{comment_id}")
async def delete_comment(comment_id: int, db: Session = Depends(get_db)):
    """
    Delete a comment and all its replies
    """
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # Delete the comment (cascading will handle replies and likes)
    db.delete(comment)
    db.commit()
    
    return {"message": "Comment deleted successfully"}

# Comment Like endpoints
@app.post("/api/comments/{comment_id}/like")
async def like_comment(comment_id: int, like_data: CommentLikeCreate, db: Session = Depends(get_db)):
    """
    Like a comment
    """
    # Verify comment exists
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # Check if user already liked this comment
    existing_like = db.query(CommentLike).filter(
        CommentLike.comment_id == comment_id,
        CommentLike.user_name == like_data.user_name
    ).first()
    
    if existing_like:
        raise HTTPException(status_code=400, detail="Comment already liked by this user")
    
    # Create like
    like = CommentLike(
        comment_id=comment_id,
        user_name=like_data.user_name
    )
    
    db.add(like)
    db.commit()
    db.refresh(like)
    
    return {"message": "Comment liked successfully", "like_id": like.id}

@app.delete("/api/comments/{comment_id}/like")
async def unlike_comment(comment_id: int, user_name: str, db: Session = Depends(get_db)):
    """
    Unlike a comment
    """
    # Find the like
    like = db.query(CommentLike).filter(
        CommentLike.comment_id == comment_id,
        CommentLike.user_name == user_name
    ).first()
    
    if not like:
        raise HTTPException(status_code=404, detail="Like not found")
    
    db.delete(like)
    db.commit()
    
    return {"message": "Comment unliked successfully"}

@app.get("/api/comments/{comment_id}/likes", response_model=List[CommentLikeResponse])
async def get_comment_likes(comment_id: int, db: Session = Depends(get_db)):
    """
    Get all likes for a comment
    """
    # Verify comment exists
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    likes = db.query(CommentLike).filter(CommentLike.comment_id == comment_id).all()
    return [CommentLikeResponse.model_validate(like) for like in likes]

# Media Like endpoints
@app.post("/api/media/{media_id}/like")
async def like_media(media_id: int, like_data: MediaLikeCreate, db: Session = Depends(get_db)):
    """
    Like a media post
    """
    # Verify media post exists
    media_post = db.query(MediaPost).filter(MediaPost.id == media_id).first()
    if not media_post:
        raise HTTPException(status_code=404, detail="Media post not found")
    
    # Check if user already liked this media post
    existing_like = db.query(MediaLike).filter(
        MediaLike.media_post_id == media_id,
        MediaLike.user_name == like_data.user_name
    ).first()
    
    if existing_like:
        raise HTTPException(status_code=400, detail="Media post already liked by this user")
    
    # Create like
    like = MediaLike(
        media_post_id=media_id,
        user_name=like_data.user_name
    )
    
    db.add(like)
    db.commit()
    db.refresh(like)
    
    return {"message": "Media post liked successfully", "like_id": like.id}

@app.delete("/api/media/{media_id}/like")
async def unlike_media(media_id: int, user_name: str, db: Session = Depends(get_db)):
    """
    Unlike a media post
    """
    # Find the like
    like = db.query(MediaLike).filter(
        MediaLike.media_post_id == media_id,
        MediaLike.user_name == user_name
    ).first()
    
    if not like:
        raise HTTPException(status_code=404, detail="Like not found")
    
    db.delete(like)
    db.commit()
    
    return {"message": "Media post unliked successfully"}

@app.get("/api/media/{media_id}/likes", response_model=List[MediaLikeResponse])
async def get_media_likes(media_id: int, db: Session = Depends(get_db)):
    """
    Get all likes for a media post
    """
    # Verify media post exists
    media_post = db.query(MediaPost).filter(MediaPost.id == media_id).first()
    if not media_post:
        raise HTTPException(status_code=404, detail="Media post not found")
    
    likes = db.query(MediaLike).filter(MediaLike.media_post_id == media_id).all()
    return [MediaLikeResponse.model_validate(like) for like in likes]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

