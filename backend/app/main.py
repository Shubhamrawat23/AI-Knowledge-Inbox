from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.modules.routers import router

app = FastAPI(title="AI Knowledge Inbox API",)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
