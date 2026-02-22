from datetime import datetime, timezone
from typing import List, Optional, Any
from sqlmodel import SQLModel, Field, Column, JSON

class MindMapBase(SQLModel):
    title: str
    nodes: List[Any] = Field(default_factory=list, sa_column=Column(JSON))
    edges: List[Any] = Field(default_factory=list, sa_column=Column(JSON))

class MindMap(MindMapBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MindMapCreate(MindMapBase):
    pass

class MindMapRead(MindMapBase):
    id: int
    created_at: datetime
    updated_at: datetime

class MindMapUpdate(SQLModel):
    title: Optional[str] = None
    nodes: Optional[List[Any]] = None
    edges: Optional[List[Any]] = None
