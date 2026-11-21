import os, json, hashlib, hmac, secrets
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional
import urllib.error
import urllib.request
from fastapi import FastAPI, Depends, HTTPException  # type: ignore[import-not-found]

def load_dotenv(path):
 try:
  lines=Path(path).read_text(encoding="utf-8").splitlines()
 except OSError:
  return False
 for line in lines:
  line=line.strip()
  if not line or line.startswith("#") or "=" not in line: continue
  key,value=line.split("=",1)
  key=key.strip()
  value=value.strip().strip("\"'")
  if key: os.environ.setdefault(key,value)
 return True
from fastapi.middleware.cors import CORSMiddleware  # type: ignore[import-not-found]
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials  # type: ignore[import-not-found]
from fastapi.staticfiles import StaticFiles  # type: ignore[import-not-found]
from fastapi.responses import FileResponse  # type: ignore[import-not-found]
from pydantic import BaseModel, EmailStr, Field, ValidationError  # type: ignore[import-not-found]
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Boolean, ForeignKey  # type: ignore[import-not-found]
from sqlalchemy.orm import declarative_base, sessionmaker, Session  # type: ignore[import-not-found]
from jose import jwt, JWTError  # type: ignore[import-not-found]

ROOT=Path(__file__).resolve().parents[1]
load_dotenv(ROOT/".env")
DB_URL=os.getenv("DATABASE_URL",f"sqlite:///{ROOT/'nourilab.db'}")
if os.getenv("VERCEL") and DB_URL.startswith("sqlite"):
 raise RuntimeError("Set DATABASE_URL to a persistent PostgreSQL database on Vercel.")
engine=create_engine(DB_URL,connect_args={"check_same_thread":False} if DB_URL.startswith("sqlite") else {},pool_pre_ping=True)
SessionLocal=sessionmaker(bind=engine,autoflush=False,autocommit=False)
Base=declarative_base()
def hash_password(password:str)->str:
 salt=secrets.token_bytes(16)
 digest=hashlib.pbkdf2_hmac("sha256",password.encode(),salt,310_000)
 return f"pbkdf2_sha256$310000${salt.hex()}${digest.hex()}"
def verify_password(password:str,password_hash:str)->bool:
 try:
  scheme,iterations,salt,digest=password_hash.split("$",3)
  if scheme!="pbkdf2_sha256": return False
  actual=hashlib.pbkdf2_hmac("sha256",password.encode(),bytes.fromhex(salt),int(iterations)).hex()
  return hmac.compare_digest(actual,digest)
 except (ValueError,TypeError):
  return False
SECRET=os.getenv("SECRET_KEY")
if not SECRET or len(SECRET)<32 or SECRET in {"development-secret-change-before-deployment","replace-with-a-long-random-secret"}:
 raise RuntimeError("Set a strong, unique SECRET_KEY of at least 32 characters before starting NouriLab.")
bearer=HTTPBearer(auto_error=False)

class User(Base):
 __tablename__="users"
 id=Column(Integer,primary_key=True); name=Column(String(160)); email=Column(String(255),unique=True,index=True); password_hash=Column(String(255)); is_admin=Column(Boolean,default=False); created_at=Column(DateTime,default=datetime.utcnow)
class Ingredient(Base):
 __tablename__="ingredients"
 id=Column(String(80),primary_key=True); name=Column(String(160)); scientific_name=Column(String(200)); category=Column(String(100)); origin=Column(String(160)); description=Column(Text); applications=Column(Text)
class Saved(Base):
 __tablename__="saved"
 id=Column(Integer,primary_key=True); user_id=Column(Integer,ForeignKey("users.id")); kind=Column(String(40)); payload=Column(Text); created_at=Column(DateTime,default=datetime.utcnow)
class Submission(Base):
 __tablename__="submissions"
 id=Column(Integer,primary_key=True); user_id=Column(Integer,ForeignKey("users.id")); kind=Column(String(40)); payload=Column(Text); status=Column(String(30),default="pending"); created_at=Column(DateTime,default=datetime.utcnow)
Base.metadata.create_all(engine)

def db_dep():
 db=SessionLocal()
 try: yield db
 finally: db.close()

with SessionLocal() as db:
 if db.query(Ingredient).count()==0:
  for x in json.loads((ROOT/"data/ingredient_seed.json").read_text()):
   db.add(Ingredient(id=x["id"],name=x["name"],scientific_name=x["scientific_name"],category=x["category"],origin=x["origin"],description=x["description"],applications=json.dumps(x["applications"])))
  db.commit()

app=FastAPI(title="NouriLab API",version="1.0.0")
app.add_middleware(CORSMiddleware,allow_origins=[os.getenv("FRONTEND_ORIGIN","*")],allow_methods=["*"],allow_headers=["*"],allow_credentials=True)

class Register(BaseModel):
 name:str=Field(min_length=2,max_length=160); email:EmailStr; password:str=Field(min_length=8,max_length=128)
class Login(BaseModel):
 email:EmailStr; password:str
class SaveIn(BaseModel):
 kind:str; payload:dict
class ScreenIn(BaseModel):
 ingredient_ids:list[str]; application:str
class BlendRecommendationIn(BaseModel):
 ingredient_id:str=Field(min_length=1,max_length=80); application:str=Field(min_length=2,max_length=80)
class BlendRecommendation(BaseModel):
 partner_id:str=Field(min_length=1,max_length=80); primary_percentage:int=Field(ge=1,le=99); partner_percentage:int=Field(ge=1,le=99)
 rationale:str=Field(min_length=10,max_length=1200); evidence_gaps:list[str]=Field(min_length=1,max_length=8)

BLEND_APPLICATIONS={"Plant-based milk","Plant-based burger","Plant-based yoghurt","Plant-based sausage","Meat analogue"}

def token_for(u):
 return jwt.encode({"sub":str(u.id),"exp":datetime.utcnow()+timedelta(hours=1)},SECRET,algorithm="HS256")
def get_user(c:Optional[HTTPAuthorizationCredentials]=Depends(bearer),db:Session=Depends(db_dep)):
 if not c: raise HTTPException(401,"Sign in required")
 try: uid=int(jwt.decode(c.credentials,SECRET,algorithms=["HS256"])["sub"])
 except (JWTError,ValueError,KeyError): raise HTTPException(401,"Invalid or expired session")
 u=db.query(User).get(uid)
 if not u: raise HTTPException(401,"Account not found")
 return u
def admin(u=Depends(get_user)):
 if not u.is_admin: raise HTTPException(403,"Administrator access required")
 return u
def item(x):
 return {"id":x.id,"name":x.name,"scientific_name":x.scientific_name,"category":x.category,"origin":x.origin,"description":x.description,"applications":json.loads(x.applications),"functional_properties":None,"data_note":"No verified functional-property measurements are loaded for this starter record."}

@app.get("/api/health")
def health(): return {"status":"ok","service":"NouriLab API"}
@app.post("/api/auth/register")
def register(d:Register,db:Session=Depends(db_dep)):
 if db.query(User).filter(User.email==d.email.lower()).first(): raise HTTPException(409,"Email already registered")
 u=User(name=d.name.strip(),email=d.email.lower(),password_hash=hash_password(d.password)); db.add(u); db.commit(); db.refresh(u)
 return {"access_token":token_for(u),"user":{"id":u.id,"name":u.name,"email":u.email}}
@app.post("/api/auth/login")
def login(d:Login,db:Session=Depends(db_dep)):
 u=db.query(User).filter(User.email==d.email.lower()).first()
 if not u or not verify_password(d.password,u.password_hash): raise HTTPException(401,"Incorrect email or password")
 return {"access_token":token_for(u),"user":{"id":u.id,"name":u.name,"email":u.email}}
@app.get("/api/auth/me")
def me(u=Depends(get_user)): return {"id":u.id,"name":u.name,"email":u.email,"is_admin":u.is_admin}
@app.get("/api/ingredients")
def ingredients(q:Optional[str]=None,db:Session=Depends(db_dep)):
 rows=db.query(Ingredient).all()
 if q: rows=[x for x in rows if q.lower() in (x.name+" "+x.scientific_name+" "+x.category).lower()]
 return [item(x) for x in rows]
@app.get("/api/ingredients/{iid}")
def ingredient(iid:str,db:Session=Depends(db_dep)):
 x=db.query(Ingredient).get(iid)
 if not x: raise HTTPException(404,"Ingredient not found")
 return item(x)
@app.post("/api/analysis/screen")
def screen(d:ScreenIn,db:Session=Depends(db_dep)):
 results=[]
 for iid in d.ingredient_ids:
  x=db.query(Ingredient).get(iid)
  if x:
   apps=[a.lower() for a in json.loads(x.applications)]
   match=any(d.application.lower() in a.lower() or a.lower() in d.application.lower() for a in apps)
   results.append({"ingredient":x.name,"catalogue_match":match,"status":"candidate for further investigation" if match else "insufficient application evidence","score":None,"explanation":"Catalogue tags are discovery aids only. No validated functional measurements are available to calculate scientific suitability.","missing_data":["protein solubility","emulsifying properties","water interaction properties","viscosity or texture data","sample processing form","source-linked measurements"]})
 return {"application":d.application,"method":"catalogue-level rule screening","is_machine_learning":False,"results":results,"notice":"Not a trained AI model, probability or validated prediction."}
def request_blend_recommendation(primary,application,candidates):
 api_key=os.getenv("GEMINI_API_KEY")
 if not api_key: raise HTTPException(503,"AI blend suggestions are not configured. Set GEMINI_API_KEY on the server.")
 prompt={"primary_ingredient":{"id":primary.id,"name":primary.name,"category":primary.category,"description":primary.description,"applications":json.loads(primary.applications)},"target_application":application,"candidates":[{"id":x.id,"name":x.name,"category":x.category,"description":x.description,"applications":json.loads(x.applications)} for x in candidates]}
 model=os.getenv("GEMINI_MODEL","gemini-3.5-flash-lite")
 body={"systemInstruction":{"parts":[{"text":"You are a cautious food-formulation research assistant. From the supplied catalogue only, propose one complementary ingredient and a starting bench-trial ratio. The catalogue has no verified protein composition or functional measurements. Do not claim an optimal, perfect, safer, more nutritious, synergistic, or validated blend. Do not invent data or properties. Prefer candidates whose application tags match the target; avoid ingredients whose description flags unresolved safety evaluation. If evidence is insufficient, say so in the rationale and list the measurements/trials needed. Return only JSON with partner_id (a candidate ID), primary_percentage (integer), partner_percentage (integer), rationale (string), and evidence_gaps (array of strings). The two percentages must be between 1 and 99 and sum to 100. This is a hypothesis for testing, not a prediction."}]},
  "contents":[{"parts":[{"text":json.dumps(prompt,ensure_ascii=False)}]}],
  "generationConfig":{"responseMimeType":"application/json","temperature":0.2}}
 request=urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",data=json.dumps(body).encode("utf-8"),headers={"x-goog-api-key":api_key,"Content-Type":"application/json"},method="POST")
 try:
  with urllib.request.urlopen(request,timeout=35) as response: data=json.loads(response.read().decode("utf-8"))
 except urllib.error.HTTPError as e:
  if e.code == 429:
   detail="Gemini API quota or rate limit reached. Check Google AI Studio usage and limits, then try again later."
  elif e.code in (401,403):
   detail="Gemini API key is invalid or does not have API access. Check GEMINI_API_KEY and the Google AI Studio project."
  elif e.code == 404:
   detail=f"Gemini model '{model}' is unavailable. Check GEMINI_MODEL and the model access for this key."
  else:
   detail=f"Gemini API request failed with HTTP {e.code}. Check the server API configuration and try again."
  raise HTTPException(502,detail) from e
 except (urllib.error.URLError,TimeoutError) as e:
  raise HTTPException(502,"Could not reach Gemini. Check the server connection and try again.") from e
 except (json.JSONDecodeError,UnicodeDecodeError) as e:
  raise HTTPException(502,"Gemini returned an invalid response. Try again.") from e
 try:
  content="".join(part["text"] for part in data["candidates"][0]["content"]["parts"] if "text" in part)
  suggestion=BlendRecommendation.model_validate_json(content)
 except (KeyError,IndexError,TypeError,ValidationError,ValueError) as e:
  raise HTTPException(502,"Gemini returned a blend suggestion in an invalid format. Try again.") from e
 candidate_ids={x.id for x in candidates}
 if suggestion.partner_id not in candidate_ids or suggestion.primary_percentage+suggestion.partner_percentage!=100:
  raise HTTPException(502,"Gemini returned an invalid ingredient or ratio. Try again.")
 return suggestion

@app.post("/api/blends/recommend")
def recommend_blend(d:BlendRecommendationIn,db:Session=Depends(db_dep)):
 if d.application not in BLEND_APPLICATIONS: raise HTTPException(422,"Choose a supported target application.")
 primary=db.query(Ingredient).get(d.ingredient_id)
 if not primary: raise HTTPException(404,"Ingredient not found")
 candidates=db.query(Ingredient).filter(Ingredient.id!=primary.id).all()
 if not candidates: raise HTTPException(422,"No alternative catalogue ingredients are available.")
 suggestion=request_blend_recommendation(primary,d.application,candidates)
 partner=next(x for x in candidates if x.id==suggestion.partner_id)
 return {"primary_ingredient":{"id":primary.id,"name":primary.name},"partner":{"id":partner.id,"name":partner.name},"primary_percentage":suggestion.primary_percentage,"partner_percentage":suggestion.partner_percentage,"rationale":suggestion.rationale,"evidence_gaps":suggestion.evidence_gaps,"notice":"AI-generated experimental starting point only. Not an optimized, validated, safety, nutrition, or performance prediction. Test and verify both ingredients and the blend."}
@app.post("/api/saved")
def save(d:SaveIn,u=Depends(get_user),db:Session=Depends(db_dep)):
 s=Saved(user_id=u.id,kind=d.kind,payload=json.dumps(d.payload));db.add(s);db.commit();db.refresh(s);return {"id":s.id,"saved":True}
@app.get("/api/saved")
def saved(u=Depends(get_user),db:Session=Depends(db_dep)):
 return [{"id":s.id,"kind":s.kind,"payload":json.loads(s.payload),"created_at":s.created_at.isoformat()} for s in db.query(Saved).filter(Saved.user_id==u.id).all()]
@app.post("/api/submissions")
def submit(d:SaveIn,u=Depends(get_user),db:Session=Depends(db_dep)):
 s=Submission(user_id=u.id,kind=d.kind,payload=json.dumps(d.payload));db.add(s);db.commit();return {"status":"pending_review"}
FRONT=ROOT/"frontend"
app.mount("/assets",StaticFiles(directory=FRONT/"assets"),name="assets")
@app.get("/")
def auth_page(): return FileResponse(FRONT/"auth.html")
@app.get("/app")
def home(): return FileResponse(FRONT/"index.html")
app.mount("/",StaticFiles(directory=FRONT,html=True),name="frontend")
