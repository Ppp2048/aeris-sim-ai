from fastapi import APIRouter, Depends, HTTPException, status

from app.auth import create_access_token, get_current_user, hash_password, verify_password
from app.database import get_connection
from app.schemas import TokenResponse, UserLogin, UserRegister, UserResponse


router = APIRouter()


def _user_response(row) -> UserResponse:
    return UserResponse(
        id=int(row["id"]),
        name=str(row["name"]),
        email=str(row["email"]),
        role=row["role"],
        created_at=str(row["created_at"]),
    )


@router.post("/register", response_model=TokenResponse)
def register(payload: UserRegister) -> TokenResponse:
    with get_connection() as conn:
        existing = conn.execute("SELECT id FROM users WHERE email = ?", (payload.email,)).fetchone()
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered")
        cursor = conn.execute(
            """
            INSERT INTO users (name, email, hashed_password, role)
            VALUES (?, ?, ?, ?)
            """,
            (payload.name, payload.email, hash_password(payload.password), payload.role),
        )
        user = conn.execute(
            "SELECT id, name, email, role, created_at FROM users WHERE id = ?",
            (cursor.lastrowid,),
        )
        row = user.fetchone()
    user_response = _user_response(row)
    return TokenResponse(access_token=create_access_token(user_response.email), user=user_response)


@router.post("/login", response_model=TokenResponse)
def login(payload: UserLogin) -> TokenResponse:
    with get_connection() as conn:
        user = conn.execute(
            "SELECT id, name, email, hashed_password, role, created_at FROM users WHERE email = ?",
            (payload.email,),
        ).fetchone()
    if not user or not verify_password(payload.password, user["hashed_password"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    user_response = _user_response(user)
    return TokenResponse(access_token=create_access_token(user_response.email), user=user_response)


@router.get("/me", response_model=UserResponse)
def me(current_user: UserResponse = Depends(get_current_user)) -> UserResponse:
    return current_user
