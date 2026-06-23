import os
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(title="SMM Panel Backend API")

# Setup CORS for frontend to bypass cross-origin errors
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration keys
SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("VITE_SUPABASE_ANON_KEY", "")
SMM_API_KEY = os.environ.get("SMM_API_KEY", "")
SMM_API_URL = "https://socialuphub.com/api/v2"

# Setup Supabase Client
supabase: Client = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# --- Data Pydantic Models ---
class SyncRequest(BaseModel):
    force_reset: bool = False

class OrderRequest(BaseModel):
    serviceId: str
    targetUrl: str
    quantity: int

# --- Helper Methods ---
async def call_smm_api(action: str, **kwargs):
    """Makes a smooth, async, non-blocking HTTP request to the external SMM Provider API."""
    payload = {"key": SMM_API_KEY, "action": action, **kwargs}
    async with httpx.AsyncClient() as client:
        response = await client.post(SMM_API_URL, data=payload, timeout=20.0)
        response.raise_for_status()
        return response.json()

# --- API Routes ---
@app.get("/api/health")
async def health_check():
    """Health check for Render to ensure server is awake."""
    return {"status": "ok"}

@app.post("/api/smm/admin/services/sync")
async def sync_services(req: SyncRequest):
    """Sync categories and services from the SMM provider database using Async I/O for speed."""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")
        
    try:
        raw_services = await call_smm_api("services")
        if req.force_reset:
            # Clean up db safely
            supabase.table("smm_services").delete().neq("service_id", 0).execute()
            supabase.table("smm_categories").delete().neq("name", "").execute()

        # Insert categories
        categories = list(set([s.get("category", "Other") for s in raw_services]))
        for c in categories:
            supabase.table("smm_categories").upsert({"name": c}, on_conflict="name").execute()
            
        # Optional: set all services to inactive before updating
        if not req.force_reset:
            supabase.table("smm_services").update({"is_active": False}).neq("service_id", 0).execute()
             
        # Insert/Update services
        for item in raw_services:
            supabase.table("smm_services").upsert({
                "service_id": int(item["service"]),
                "category_name": item.get("category", "Other"),
                "api_name": item["name"],
                "provider_rate": float(item["rate"]),
                "min_order": int(item["min"]),
                "max_order": int(item["max"]),
                "type": item.get("type", "Default"),
                "refill": bool(item.get("refill", False)),
                "is_active": True
            }, on_conflict="service_id").execute()
            
        balance_res = await call_smm_api("balance")
        return {"success": True, "count": len(raw_services), "balance": balance_res.get("balance", 0)}
        
    except httpx.HTTPError as he:
        raise HTTPException(status_code=502, detail=f"SMM API Error: {he}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/smm/services")
async def get_services():
    """Retrieve catalog of active services from Supabase"""
    if not supabase: return {"success": False, "error": "Supabase not configured"}

    try:
        categories_res = supabase.table("smm_categories").select("*").execute()
        services_res = supabase.table("smm_services").select("*").eq("is_active", True).execute()
        
        # Build category hash map for lookups
        categories_map = {c["name"]: c for c in categories_res.data}
        
        # Format the services for mapping 
        format_services = []
        for row in services_res.data:
            cat = categories_map.get(row["category_name"], {})
            if cat.get("is_active") is False:
                continue
                
            # Apply custom margin (You would want to map PROFIT_MARKUP_PERCENT here dynamically)
            applied_margin = row.get("custom_margin") or cat.get("custom_margin") or 15.0  # fallback 15%
            
            original_rate = float(row["provider_rate"])
            rate_per_1000 = round(original_rate * (1 + applied_margin / 100), 2)
            
            format_services.append({
                 "id": str(row["service_id"]),
                 "category": row["category_name"],
                 "name": row.get("custom_name") or row["api_name"],
                 "ratePer1000": rate_per_1000, 
                 "min": row["min_order"],
                 "max": row["max_order"],
                 "description": row.get("custom_description") or ""
            })

        return {"success": True, "services": format_services}
    except Exception as e:
         return {"success": False, "error": str(e)}

if __name__ == "__main__":
    import uvicorn
    # To run locally: python server.py
    # To run on Render, specify the "Render start command": uvicorn server:app --host 0.0.0.0 --port $PORT
    uvicorn.run("server:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8000)), reload=True)
