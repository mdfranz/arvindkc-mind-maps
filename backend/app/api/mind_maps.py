from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from datetime import datetime, timezone

from app.db import get_session
from app.models.mind_map import MindMap, MindMapCreate, MindMapRead, MindMapUpdate

router = APIRouter(prefix="/mindmaps", tags=["mindmaps"])

@router.post("/", response_model=MindMapRead, status_code=status.HTTP_201_CREATED)
async def create_mind_map(
    *,
    session: Session = Depends(get_session),
    mind_map_in: MindMapCreate
):
    db_mind_map = MindMap.model_validate(mind_map_in)
    session.add(db_mind_map)
    session.commit()
    session.refresh(db_mind_map)
    return db_mind_map

@router.get("/", response_model=List[MindMapRead])
async def list_mind_maps(
    *,
    session: Session = Depends(get_session),
    offset: int = 0,
    limit: int = 100
):
    statement = select(MindMap).offset(offset).limit(limit)
    results = session.exec(statement)
    return results.all()

@router.get("/{mind_map_id}", response_model=MindMapRead)
async def get_mind_map(
    *,
    session: Session = Depends(get_session),
    mind_map_id: int
):
    db_mind_map = session.get(MindMap, mind_map_id)
    if not db_mind_map:
        raise HTTPException(status_code=404, detail="Mind map not found")
    return db_mind_map

@router.patch("/{mind_map_id}", response_model=MindMapRead)
async def update_mind_map(
    *,
    session: Session = Depends(get_session),
    mind_map_id: int,
    mind_map_in: MindMapUpdate
):
    db_mind_map = session.get(MindMap, mind_map_id)
    if not db_mind_map:
        raise HTTPException(status_code=404, detail="Mind map not found")
    
    update_data = mind_map_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_mind_map, key, value)
    
    db_mind_map.updated_at = datetime.now(timezone.utc)
    session.add(db_mind_map)
    session.commit()
    session.refresh(db_mind_map)
    return db_mind_map

from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.responses import PlainTextResponse
import json

# ... existing imports ...

@router.delete("/{mind_map_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mind_map(
    *,
    session: Session = Depends(get_session),
    mind_map_id: int
):
    db_mind_map = session.get(MindMap, mind_map_id)
    if not db_mind_map:
        raise HTTPException(status_code=404, detail="Mind map not found")
    
    session.delete(db_mind_map)
    session.commit()
    return None

@router.get("/{mind_map_id}/export/sql", response_class=PlainTextResponse)
async def export_mind_map_sql(
    *,
    session: Session = Depends(get_session),
    mind_map_id: int
):
    db_mind_map = session.get(MindMap, mind_map_id)
    if not db_mind_map:
        raise HTTPException(status_code=404, detail="Mind map not found")

    # Escaping single quotes for SQL
    title_esc = db_mind_map.title.replace("'", "''")
    nodes_json = json.dumps(db_mind_map.nodes).replace("'", "''")
    edges_json = json.dumps(db_mind_map.edges).replace("'", "''")
    created_at = db_mind_map.created_at.isoformat()
    updated_at = db_mind_map.updated_at.isoformat()

    sql = (
        f"-- MyMindMap Export: \"{db_mind_map.title}\"\n"
        f"-- Generated at: {datetime.now(timezone.utc).isoformat()}\n"
        f"INSERT INTO mindmap (title, nodes, edges, created_at, updated_at) \n"
        f"VALUES (\n"
        f"    '{title_esc}', \n"
        f"    '{nodes_json}', \n"
        f"    '{edges_json}', \n"
        f"    '{created_at}', \n"
        f"    '{updated_at}'\n"
        f");"
    )

    filename = f"mindmap-{mind_map_id}.sql"
    return PlainTextResponse(
        content=sql,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
