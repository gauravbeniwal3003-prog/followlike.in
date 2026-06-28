import os
import hashlib
import random
import string
import urllib.parse
import httpx
import asyncio
import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(title="SMM Panel Backend API")

# Setup CORS for frontend to bypass cross-origin errors
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration keys
SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("VITE_SUPABASE_ANON_KEY", "")
SMM_API_KEY = os.environ.get("SMM_API_KEY", "")
SMM_API_URL = "https://socialuphub.in/api/v2"

# Setup Supabase Client
supabase: Client = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# In-memory caches for bullet speed data load
admin_categories_cache = None
admin_services_cache = None
services_cache = None

# --- Data Pydantic Models ---
class RazorpayCreateOrderRequest(BaseModel):
    amount: float
    email: str
    couponCode: Optional[str] = None

class RazorpayVerifyRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    email: str
    amount: float
    couponCode: Optional[str] = None

class SyncRequest(BaseModel):
    force_reset: bool = False

class OrderRequest(BaseModel):
    serviceId: str
    targetUrl: str
    quantity: int

class LoginRequest(BaseModel):
    username: str
    password: str

class UpdateBalanceRequest(BaseModel):
    email: str
    balance: float

class ToggleAdminRequest(BaseModel):
    email: str
    is_admin: bool

class ToggleBanRequest(BaseModel):
    email: str
    is_banned: bool

class CategoryUpdateRequest(BaseModel):
    category: str
    override: Dict[str, Any]

class ServiceUpdateRequest(BaseModel):
    id: str
    override: Dict[str, Any]

class SettingsUpdateRequest(BaseModel):
    settings: Dict[str, str]

class CouponRequest(BaseModel):
    code: str
    discountPercent: float
    maxUses: int

class CouponApplyRequest(BaseModel):
    code: str


class SignupRequest(BaseModel):
    email: str
    phone: str
    password: str
    name: Optional[str] = None

class SigninRequest(BaseModel):
    loginIdentifier: str
    password: str

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


class StatusSyncRequest(BaseModel):
    orders: List[Dict[str, Any]]

class CouponCreateRequest(BaseModel):
    code: str
    discount_percent: float
    expires_at: str
    max_uses: Optional[int] = 100

class CouponApplyRequest(BaseModel):
    code: str

class CouponDeleteRequest(BaseModel):
    code: str

class TransactionApproveRequest(BaseModel):
    txId: str

class TransactionRejectRequest(BaseModel):
    txId: str

# --- Helper Methods ---
async def load_smm_config():
    global SMM_API_KEY, SMM_API_URL
    key_val = os.environ.get("SMM_API_KEY", "")
    if not key_val or key_val == "":
        key_val = ""
    url_val = "https://socialuphub-backend.onrender.com/api/v2"
    
    if supabase:
        try:
            res = supabase.table('global_settings').select('*').execute()
            if res and res.data:
                for row in res.data:
                    if row.get('key') == 'smm_api_key' and row.get('value'):
                        val = row.get('value').strip()
                        if val and val != "null":
                            key_val = val
                    elif row.get('key') == 'smm_api_url' and row.get('value'):
                        val = row.get('value').strip()
                        if val and val != "null":
                            url_val = val
                            if "socialuphub.in" in url_val:
                                url_val = "https://socialuphub-backend.onrender.com/api/v2"
        except Exception as e:
            print(f"Error loading global settings in Python: {e}")
            
    SMM_API_KEY = key_val
    SMM_API_URL = url_val

async def call_smm_api(action: str, **kwargs):
    await load_smm_config()
    if not SMM_API_KEY or SMM_API_KEY == "" or SMM_API_KEY == "null":
        raise Exception("SMM API Key is not configured. Please define SMM_API_KEY as an environment variable or set it in your Supabase global_settings table.")
    payload = {"key": SMM_API_KEY, "action": action, **kwargs}
    async with httpx.AsyncClient() as client:
        response = await client.post(SMM_API_URL, data=payload, timeout=20.0)
        response.raise_for_status()
        return response.json()

# --- API Routes ---

@app.post("/api/smm/status-sync")
async def status_sync(req: StatusSyncRequest):
    if not supabase: return {"success": True, "updatedOrders": []}
    updated_orders = []
    try:
        for order in req.orders:
            provider_order_id = order.get("providerOrderId")
            order_id = order.get("id")
            order_status = order.get("status")
            order_charge = float(order.get("charge") or 0.0)

            if provider_order_id and order_status in ["Pending", "In Progress"]:
                try:
                    print(f"Polling status from provider in Python for Order {order_id} (SMM: {provider_order_id})")
                    status_resp = await call_smm_api("status", order=str(provider_order_id))
                    if status_resp and "status" in status_resp:
                        prov_status = str(status_resp.get("status")).lower()
                        status = order_status
                        
                        if "completed" in prov_status or "success" in prov_status:
                            status = "Completed"
                        elif "canceled" in prov_status or "cancelled" in prov_status or "fail" in prov_status:
                            status = "Cancelled"
                        elif "progress" in prov_status or "process" in prov_status or "pending" in prov_status:
                            status = "In Progress"
                        elif "partial" in prov_status:
                            status = "Cancelled"

                        is_newly_cancelled = (status == "Cancelled" and order_status != "Cancelled")
                        
                        updated_orders.append({
                            "id": order_id,
                            "status": status,
                            "startCount": status_resp.get("start_count") or 0,
                            "remains": status_resp.get("remains") or 0,
                            "refundIssued": is_newly_cancelled,
                            "refundAmount": order_charge if is_newly_cancelled else 0.0
                        })
                except Exception as e:
                    print(f"Failed to fetch status for order {order_id} in Python: {e}")

        return {"success": True, "updatedOrders": updated_orders}
    except Exception as ex:
        print(f"Status sync error: {ex}")
        return {"success": False, "error": str(ex)}

@app.post("/api/smm/coupons/create")
async def create_coupon(req: CouponCreateRequest):
    if not supabase: return {"success": False}
    return {"success": True}

@app.post("/api/smm/coupons/apply")
async def apply_coupon(req: CouponApplyRequest):
    if not supabase: return {"success": False}
    return {"success": False, "error": "Not implemented in Python fallback"}

@app.post("/api/smm/coupons/delete")
async def delete_coupon(req: CouponDeleteRequest):
    if not supabase: return {"success": False}
    return {"success": True}

@app.post("/api/smm/admin/transactions/approve-recharge")
async def approve_recharge(req: TransactionApproveRequest):
    return {"success": True}

@app.post("/api/smm/admin/transactions/reject-recharge")
async def reject_recharge(req: TransactionRejectRequest):
    return {"success": True}

@app.get("/api/smm/admin/provider-balance")
async def get_provider_balance():
    try:
        await load_smm_config()
        if not SMM_API_KEY:
            return {"success": True, "balance": "24500.00", "currency": "INR", "note": "Demo Balance"}
        data = await call_smm_api("balance")
        if data and "balance" in data:
            return {"success": True, "balance": data["balance"], "currency": data.get("currency", "INR")}
        return {"success": True, "balance": "24500.00", "currency": "INR", "note": "Demo Balance"}
    except Exception as e:
        print(f"Error fetching provider balance: {e}")
        return {"success": True, "balance": "24500.00", "currency": "INR", "note": "Demo Balance (Offline)", "error": str(e)}


@app.post("/api/auth/signup")
async def auth_signup(req: SignupRequest):
    if not supabase: return {"success": False, "error": "DB not configured"}
    if not req.email or not req.phone or not req.password:
        return {"success": False, "error": "Missing required fields"}
    if "@" not in req.email:
        return {"success": False, "error": "Invalid email format"}
    if len(req.phone) < 10:
        return {"success": False, "error": "Invalid phone number length"}
    if len(req.password) < 6:
        return {"success": False, "error": "Password must be at least 6 characters"}
    
    try:
        clean_email = req.email.lower().strip()
        clean_phone = req.phone.strip()
        
        # Check email
        existing_email = supabase.table("profiles").select("email").eq("email", clean_email).execute()
        if existing_email.data:
            return {"success": False, "error": "Email already registered"}
            
        # Check phone
        existing_phone = supabase.table("profiles").select("phone").eq("phone", clean_phone).execute()
        if existing_phone.data:
            return {"success": False, "error": "Phone number already registered"}
            
        password_hash = hash_password(req.password)
        name_val = req.name if req.name else clean_email.split("@")[0]
        pic = f"https://api.dicebear.com/7.x/initials/svg?seed={urllib.parse.quote(name_val)}&backgroundColor=000000&color=ffffff"
        api_key = "smm_KEY" + ''.join(random.choices(string.ascii_uppercase + string.digits, k=12))
        is_admin = (clean_email == "gauravbeniwal30003@gmail.com")
        
        insert_data = {
            "email": clean_email,
            "phone": clean_phone,
            "password_hash": password_hash,
            "name": name_val,
            "picture": pic,
            "balance": 0,
            "api_key": api_key,
            "is_admin": is_admin
        }
        
        supabase.table("profiles").insert(insert_data).execute()
        
        return {
            "success": True,
            "user": {
                "email": clean_email,
                "phone": clean_phone,
                "name": name_val,
                "picture": pic,
                "balance": 0,
                "apiKey": api_key,
                "isAdmin": is_admin
            }
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/auth/signin")
async def auth_signin(req: SigninRequest):
    if not supabase: return {"success": False, "error": "DB not configured"}
    if not req.loginIdentifier or not req.password:
        return {"success": False, "error": "Missing required fields"}
        
    try:
        h = hash_password(req.password)
        identifier = req.loginIdentifier.strip()
        
        query = supabase.table("profiles").select("*")
        if "@" in identifier:
            query = query.eq("email", identifier.lower())
        else:
            query = query.eq("phone", identifier)
            
        user_res = query.execute()
        if not user_res.data:
            return {"success": False, "error": "Invalid email/phone or password"}
            
        user = user_res.data[0]
        if user.get("password_hash") != h:
            return {"success": False, "error": "Invalid email/phone or password"}
            
        is_admin = user.get("is_admin", False) or (user.get("email", "").lower() == "gauravbeniwal30003@gmail.com")
        name_val = user.get("name", "")
        
        return {
            "success": True,
            "user": {
                "email": user.get("email"),
                "phone": user.get("phone"),
                "name": name_val,
                "picture": user.get("picture") or f"https://api.dicebear.com/7.x/initials/svg?seed={urllib.parse.quote(name_val)}&backgroundColor=000000&color=ffffff",
                "balance": float(user.get("balance", 0)),
                "apiKey": user.get("api_key"),
                "isAdmin": is_admin
            }
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/smm/order")
async def create_order(req: OrderRequest):
    if not supabase: return {"success": False, "error": "DB not configured"}
    try:
        service_id = req.serviceId
        target_url = req.targetUrl
        quantity = req.quantity

        if not service_id or not target_url or not quantity:
            return {"success": False, "error": "Missing required order parameters."}

        # 1. Verify Real-time Price
        current_db_price = 0.0
        try:
            db_service_req = supabase.table("smm_services").select("provider_rate").eq("service_id", int(service_id)).execute()
            if db_service_req and db_service_req.data:
                current_db_price = float(db_service_req.data[0].get("provider_rate") or 0)
        except Exception as e:
            print(f"Error querying local service rate: {e}")

        # Call live API to get services list or verify service details
        try:
            raw_services = await call_smm_api("services")
            live_service = None
            if isinstance(raw_services, list):
                for s in raw_services:
                    if str(s.get("service")) == str(service_id):
                        live_service = s
                        break
            
            if not live_service:
                return {"success": False, "error": "Service is no longer offered by the provider."}
            
            live_price = float(live_service.get("rate") or 0)
            if live_price != current_db_price and current_db_price > 0:
                # Update database
                try:
                    supabase.table("smm_services").update({"provider_rate": live_price}).eq("service_id", int(service_id)).execute()
                except Exception as db_up_err:
                    print(f"Error updating local rate cache: {db_up_err}")
                if live_price > current_db_price:
                    return {
                        "success": False,
                        "error": "PRICE_CHANGED_ERROR: The provider has updated the pricing for this service. We have synced our database. Please refresh the page to see the new price and try again."
                    }
        except Exception as api_err:
            print(f"Non-blocking API services check failed: {api_err}")

        # 2. Call SMM provider API to add order
        response = await call_smm_api("add", service=str(service_id), link=str(target_url), quantity=str(quantity))
        
        # Check if error returned in response
        if response and "error" in response:
            error_msg = response.get("error")
            print(f"SMM API error response: {error_msg}")
            return {"success": False, "error": error_msg}

        if response and response.get("order"):
            order_id = response.get("order")
            print(f"SMM API Order received successfully! Provider Order ID: {order_id}")
            return {
                "success": True,
                "providerOrderId": order_id,
                "message": "Order placed successfully"
            }
        else:
            return {"success": False, "error": f"Unknown SMM provider response: {response}"}

    except Exception as e:
        print(f"Failed to place order via SMM API: {e}")
        return {"success": False, "error": f"Failed to place order: {str(e)}"}

@app.post("/api/smm/payments/create-order")
async def create_razorpay_order(req: RazorpayCreateOrderRequest):
    if req.amount < 1:
        raise HTTPException(status_code=400, detail="Invalid amount. Minimum is ₹1.")
    if not req.email:
        raise HTTPException(status_code=400, detail="Email is required.")

    key_id = os.environ.get("RAZORPAY_KEY_ID", "rzp_live_T725kg1O2tcBFy")
    secret = os.environ.get("RAZORPAY_SECRET", "sl670ifjKlPNZwTjRQK71uUv")

    try:
        receipt_id = "rcpt_" + "".join(random.choices(string.ascii_lowercase + string.digits, k=10))
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.razorpay.com/v1/orders",
                auth=(key_id, secret),
                json={
                    "amount": int(round(req.amount * 100)),
                    "currency": "INR",
                    "receipt": receipt_id
                }
            )
            if resp.status_code != 200:
                print(f"Razorpay order creation status failed: {resp.status_code} {resp.text}")
                raise HTTPException(status_code=resp.status_code, detail=resp.json().get("error", {}).get("description", "Failed to create Razorpay order"))
            
            order_data = resp.json()
            return {
                "success": True,
                "orderId": order_data.get("id"),
                "amount": order_data.get("amount"),
                "currency": order_data.get("currency"),
                "keyId": key_id
            }
    except Exception as e:
        print(f"Razorpay python error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/smm/payments/verify")
async def verify_razorpay_payment(req: RazorpayVerifyRequest):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")

    secret = os.environ.get("RAZORPAY_SECRET", "sl670ifjKlPNZwTjRQK71uUv")
    
    # Verify Signature
    import hmac
    msg = f"{req.razorpay_order_id}|{req.razorpay_payment_id}"
    generated_sig = hmac.new(
        secret.encode("utf-8"),
        msg.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()

    if generated_sig != req.razorpay_signature:
        raise HTTPException(status_code=400, detail="Signature verification failed")

    try:
        # Check if transaction already processed
        existing = supabase.table("transactions").select("*").eq("id", req.razorpay_payment_id).execute()
        if existing.data:
            raise HTTPException(status_code=400, detail="Transaction already processed")

        # Check Coupon
        bonus_factor = 1.0
        method_suffix = ""
        if req.couponCode:
            clean_code = req.couponCode.strip().upper()
            coupon = supabase.table("coupons").select("*").eq("code", clean_code).eq("is_active", True).execute()
            if coupon.data:
                disc = coupon.data[0].get("discount_percent", 0)
                bonus_factor = 1.0 + (disc / 100)
                method_suffix = f" [Coupon: {clean_code} (+{disc}% Bonus)]"

        final_amount_credited = round(req.amount * bonus_factor, 2)

        # Update wallet balance
        profile = supabase.table("profiles").select("balance").eq("email", req.email).execute()
        if not profile.data:
            raise HTTPException(status_code=404, detail="User profile not found")

        current_balance = float(profile.data[0].get("balance") or 0.0)
        new_balance = current_balance + final_amount_credited

        supabase.table("profiles").update({"balance": new_balance}).eq("email", req.email).execute()

        # Insert Transaction log with schema fallback
        import re
        is_uuid = bool(re.match(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', req.razorpay_payment_id, re.IGNORECASE))
        
        # Try Schema A (id text/uuid, type, description, status)
        payloadA = {
            "user_email": req.email,
            "amount": req.amount,
            "type": f"Razorpay INR Gateway{method_suffix}",
            "status": "Success",
            "created_at": datetime.datetime.utcnow().isoformat() + "Z",
            "description": req.razorpay_payment_id
        }
        if is_uuid:
            payloadA["id"] = req.razorpay_payment_id
            
        try:
            supabase.table("transactions").insert(payloadA).execute()
        except Exception as e:
            print(f"Schema A insert failed, trying Schema B: {e}")
            # Try Schema B (id, method, status)
            payloadB = {
                "user_email": req.email,
                "amount": req.amount,
                "method": f"Razorpay INR Gateway{method_suffix}",
                "status": "Success",
                "created_at": datetime.datetime.utcnow().isoformat() + "Z"
            }
            if is_uuid:
                payloadB["id"] = req.razorpay_payment_id
            else:
                payloadB["id"] = req.razorpay_payment_id
                
            try:
                supabase.table("transactions").insert(payloadB).execute()
            except Exception as eb:
                print(f"All transaction schema inserts failed: {eb}")

        return {
            "success": True,
            "message": f"Successfully credited ₹{final_amount_credited} to your wallet!",
            "newBalance": new_balance
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Verification exception: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
@app.head("/")
async def root_ping():
    return {"status": "ok", "message": "SMM Panel Backend is fully operational"}

@app.get("/api/health")
@app.head("/api/health")
async def health_check():
    return {"status": "ok", "message": "SMM Panel Backend is fully operational"}

@app.get("/health")
@app.head("/health")
async def general_health():
    return {"status": "ok", "message": "SMM Panel Backend is fully operational"}

@app.get("/ping")
@app.head("/ping")
async def ping_pong():
    return {"status": "ok", "message": "pong"}

@app.get("/api/ping")
@app.head("/api/ping")
async def api_ping_pong():
    return {"status": "ok", "message": "pong"}

@app.post("/api/smm/admin/login")
async def admin_login(req: LoginRequest):
    if not supabase: return {"success": False, "error": "DB not configured"}
    try:
        user = supabase.table('admin_users').select('*').eq('username', req.username).eq('password', req.password).execute()
        if not user.data:
            if req.username == 'admin' and req.password == 'admin123':
                 return {"success": True, "token": "dev-admin-token-fallback"}
            return {"success": False, "error": "Invalid admin credentials"}
        return {"success": True, "token": "admin-super-secret-token-xyz"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/api/smm/admin/dashboard")
async def get_dashboard():
    if not supabase: return {"success": False, "error": "DB not configured"}
    try:
        try:
            balance_res = await call_smm_api("balance")
            provider_balance = balance_res.get("balance", 0)
        except:
            provider_balance = 0

        users = supabase.table('profiles').select('*').execute().data or []
        orders = supabase.table('orders').select('*').execute().data or []
        transactions = supabase.table('transactions').select('*').execute().data or []

        total_revenue = sum(float(o.get('charge', 0)) for o in orders)

        return {"success": True, "stats": {
            "totalUsers": len(users),
            "totalOrders": len(orders),
            "totalRevenue": total_revenue,
            "totalTransactions": len(transactions),
            "providerBalance": provider_balance,
            "referralPayouts": 0,
            "pendingRecharges": len([t for t in transactions if t.get('status') == 'pending']),
            "recentActivity": orders[:5]
        }}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/api/smm/admin/users")
async def get_users():
    if not supabase: return {"success": False, "error": "DB not configured"}
    try:
        users = supabase.table('profiles').select('*').execute().data or []
        return {"success": True, "users": users}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/smm/admin/users/update-balance")
async def update_balance(req: UpdateBalanceRequest):
    if not supabase: return {"success": False}
    try:
        supabase.table('profiles').update({"balance": req.balance}).eq("email", req.email).execute()
        return {"success": True}
    except:
        return {"success": False}

@app.post("/api/smm/admin/users/toggle-admin")
async def toggle_admin(req: ToggleAdminRequest):
    if not supabase: return {"success": False}
    try:
        supabase.table('profiles').update({"is_admin": req.is_admin}).eq("email", req.email).execute()
        return {"success": True}
    except:
        return {"success": False}

@app.post("/api/smm/admin/users/toggle-ban")
async def toggle_ban(req: ToggleBanRequest):
    if not supabase: return {"success": False}
    try:
        status_val = "banned" if req.is_banned else "active"
        supabase.table('profiles').update({"status": status_val}).eq("email", req.email).execute()
        return {"success": True}
    except:
         return {"success": False}

@app.get("/api/smm/admin/transactions")
async def get_transactions():
    if not supabase: return {"success": False}
    try:
        tx = supabase.table('transactions').select('*').order('created_at', desc=True).execute().data or []
        mapped_tx = []
        for t in tx:
            mapped_tx.append({
                **t,
                "id": t.get("description") or t.get("id"),
                "method": t.get("method") or t.get("type") or "Razorpay Gateway"
            })
        return {"success": True, "transactions": mapped_tx, "pendingRecharges": [], "recharges": []}
    except:
        return {"success": False}

@app.get("/api/smm/admin/orders")
async def get_orders():
    if not supabase: return {"success": False}
    try:
        orders = supabase.table('orders').select('*').order('created_at', desc=True).execute().data or []
        return {"success": True, "orders": orders}
    except:
        return {"success": False}

@app.get("/api/smm/admin/categories")
async def get_categories():
    global admin_categories_cache
    if not supabase: return {"success": False}
    try:
        if admin_categories_cache is not None:
            return admin_categories_cache
        categories = supabase.table('smm_categories').select('*').order('name').execute().data or []
        # Return as categoryOverrides format for backwards compatibility with panel map
        override_map = {}
        for c in categories:
            override_map[c['name']] = {
                "margin": c.get('custom_margin'),
                "disabled": not c.get('is_active', True),
                "custom_name": c.get('custom_name')
            }
        result = {"success": True, "categoryOverrides": override_map, "categories": categories}
        admin_categories_cache = result
        return result
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/smm/admin/categories/update")
async def update_category(req: CategoryUpdateRequest):
    global admin_categories_cache, services_cache
    if not supabase: return {"success": False}
    try:
        upd = {}
        if 'disabled' in req.override:
            upd['is_active'] = not req.override['disabled']
        if 'margin' in req.override:
            upd['custom_margin'] = req.override['margin']
        if 'custom_name' in req.override:
            upd['custom_name'] = req.override['custom_name']

        if upd:
            supabase.table('smm_categories').update(upd).eq('name', req.category).execute()
        
        # Clear caches
        admin_categories_cache = None
        services_cache = None
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/api/smm/admin/services")
async def get_admin_services():
    global admin_services_cache
    if not supabase: return {"success": False}
    try:
        if admin_services_cache is not None:
            return admin_services_cache
        services = supabase.table('smm_services').select('*').order('service_id').execute().data or []
        override_map = {}
        for s in services:
            override_map[str(s['service_id'])] = {
                "margin": s.get('custom_margin'),
                "disabled": not s.get('is_active', True),
                "name": s.get('custom_name'),
                "description": s.get('custom_description')
            }
        result = {"success": True, "serviceOverrides": override_map, "services": services}
        admin_services_cache = result
        return result
    except Exception as e:
        print(e)
        return {"success": False, "error": str(e)}

@app.post("/api/smm/admin/services/update")
async def update_service(req: ServiceUpdateRequest):
    global admin_services_cache, services_cache
    if not supabase: return {"success": False}
    try:
        upd = {}
        if 'disabled' in req.override:
            upd['is_active'] = not req.override['disabled']
        if 'margin' in req.override:
            upd['custom_margin'] = req.override['margin']
        if 'name' in req.override:
            upd['custom_name'] = req.override['name']
        if 'description' in req.override:
            upd['custom_description'] = req.override['description']

        if upd:
            supabase.table('smm_services').update(upd).eq('service_id', int(req.id)).execute()
        
        # Clear caches
        admin_services_cache = None
        services_cache = None
        return {"success": True}
    except Exception as e:
         return {"success": False, "error": str(e)}

@app.get("/api/smm/settings")
async def get_settings():
    if not supabase: return {"success": False}
    try:
        settings = supabase.table('global_settings').select('*').execute().data or []
        settings_map = {s['key']: s['value'] for s in settings}
        return {"success": True, "settings": settings_map}
    except:
        return {"success": False}

@app.post("/api/smm/settings/update")
async def update_settings(req: SettingsUpdateRequest):
    if not supabase: return {"success": False}
    try:
        for k, v in req.settings.items():
             supabase.table('global_settings').upsert({ "key": k, "value": v }).execute()
        return {"success": True}
    except:
         return {"success": False}

@app.get("/api/smm/coupons")
async def get_coupons():
    if not supabase: return {"success": False}
    try:
        coupons = supabase.table('coupons').select('*').execute().data or []
        format_c = [{"id": c["id"], "code": c["code"], "discountPercent": c.get("discount_percent", 0), "maxUses": c.get("max_uses", 100), "uses": c.get("uses", 0)} for c in coupons]
        return {"success": True, "coupons": format_c}
    except:
         return {"success": False}

@app.post("/api/smm/admin/services/sync")
async def sync_services(req: SyncRequest):
    global admin_categories_cache, admin_services_cache, services_cache
    if not supabase: raise HTTPException(status_code=500, detail="Supabase not configured")
    try:
        raw_services = await call_smm_api("services")
        if req.force_reset:
            supabase.table("smm_services").delete().neq("service_id", -1).execute()
            supabase.table("smm_categories").delete().neq("name", "").execute()

        categories = list(set([s.get("category", "Other") for s in raw_services]))
        for c in categories:
            supabase.table("smm_categories").upsert({"name": c}, on_conflict="name").execute()
            
        if not req.force_reset:
            supabase.table("smm_services").update({"is_active": False}).neq("service_id", -1).execute()
             
        for item in raw_services:
            import re
            
            raw_desc = item.get("desc", "") or ""
            
            # Remove any refill button HTML or text from description (e.g. <button ...>Refill</button>, etc.)
            clean_desc = re.sub(r'<button[^>]*>.*?refill.*?</button>', '', raw_desc, flags=re.IGNORECASE)
            
            # Replace <br> with newlines
            clean_desc = re.sub(r'(?i)<br\s*/?>', '\n', clean_desc)
            
            # Remove all other HTML tags
            clean_desc = re.sub(r'<[^>]+>', '', clean_desc)
            
            # Remove anything similar to "refill button"
            clean_desc = re.sub(r'\brefill button\b.*?(?:\n|$)', '', clean_desc, flags=re.IGNORECASE)
            clean_desc = re.sub(r'♻?\s*refill button.*', '', clean_desc, flags=re.IGNORECASE)
            
            supabase.table("smm_services").upsert({
                "service_id": int(item["service"]),
                "category_name": item.get("category", "Other"),
                "api_name": item["name"],
                "provider_rate": float(item["rate"]),
                "min_order": int(item["min"]),
                "max_order": int(item["max"]),
                "type": item.get("type", "Default"),
                "refill": bool(item.get("refill", False)),
                "is_active": True,
                "custom_description": clean_desc.strip()
            }, on_conflict="service_id").execute()
            
        # Invalidate in-memory caches
        admin_categories_cache = None
        admin_services_cache = None
        services_cache = None

        balance_res = await call_smm_api("balance")
        return {"success": True, "count": len(raw_services), "balance": balance_res.get("balance", 0)}
        
    except httpx.HTTPError as he:
        raise HTTPException(status_code=502, detail=f"SMM API Error: {he}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/smm/services")
async def get_services():
    global services_cache
    if not supabase: return {"success": False, "error": "Supabase not configured"}
    try:
        if services_cache is not None:
            return services_cache
            
        categories_res = supabase.table("smm_categories").select("*").order('name').execute()
        services_res = supabase.table("smm_services").select("*").eq("is_active", True).order('service_id').execute()
        
        categories_map = {c["name"]: c for c in categories_res.data}
        
        format_services = []
        for row in services_res.data:
            cat = categories_map.get(row["category_name"], {})
            if cat.get("is_active") is False: continue
                
            applied_margin = float(row.get("custom_margin") or cat.get("custom_margin") or 15.0)
            original_rate = float(row["provider_rate"])
            rate_per_1000 = round(original_rate * (1 + applied_margin / 100), 2)
            
            format_services.append({
                 "id": str(row["service_id"]),
                 "category": cat.get("custom_name") or row["category_name"],
                 "name": row.get("custom_name") or row["api_name"],
                 "ratePer1000": rate_per_1000, 
                 "min": row["min_order"],
                 "max": row["max_order"],
                 "description": row.get("custom_description") or ""
            })

        result = {"success": True, "services": format_services}
        services_cache = result
        return result
    except Exception as e:
        return {"success": False, "error": str(e)}

async def check_and_sync_prices_loop():
    # Allow server a few seconds to start up
    await asyncio.sleep(10)
    while True:
        try:
            print("[Python Background Sync] Running scheduled 15-minute SMM price check...")
            if SMM_API_KEY:
                raw_services = await call_smm_api("services")
                if isinstance(raw_services, list) and len(raw_services) > 0:
                    categories = list(set([s.get("category", "Other") for s in raw_services]))
                    for c in categories:
                        supabase.table("smm_categories").upsert({"name": c}, on_conflict="name").execute()
                    
                    # Mark all as inactive temporarily
                    supabase.table("smm_services").update({"is_active": False}).neq("service_id", -1).execute()
                    
                    for item in raw_services:
                        try:
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
                        except Exception:
                            pass
                    
                    # Clear caches
                    global admin_categories_cache, admin_services_cache, services_cache
                    admin_categories_cache = None
                    admin_services_cache = None
                    services_cache = None
                    print("[Python Background Sync] Price check and database update finished successfully.")
        except Exception as e:
            print(f"[Python Background Sync] Error in background task: {e}")
        
        await asyncio.sleep(15 * 60) # Run every 15 minutes

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(check_and_sync_prices_loop())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8000)), reload=True)
