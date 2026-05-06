import io
import soundfile as sf
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from kokoro_onnx import Kokoro
import numpy as np

app = FastAPI()
kokoro = Kokoro("kokoro-v0_19.onnx", "voices-v1.0.bin")

# Fix for ONNXRuntime double vs float error in some versions
# Cast voice embeddings to float32
kokoro.voices = {k: v.astype(np.float32) for k, v in kokoro.voices.items()}

VOICE_MAP = {
    "af": "af",
    "af_bella": "af_bella",
    "af_nicole": "af_nicole",
    "af_sarah": "af_sarah",
    "af_sky": "af_sky",
    "am_adam": "am_adam",
    "am_michael": "am_michael",
    "bf_emma": "bf_emma",
    "bf_isabella": "bf_isabella",
    "bm_george": "bm_george",
    "bm_lewis": "bm_lewis",
    "af_heart": "af_sarah",
    "female": "af_sarah",
    "male": "am_adam",
    "alloy": "af_sarah",
    "echo": "am_adam",
    "onyx": "am_michael",
    "nova": "af_nicole",
    "shimmer": "af_bella",
}

class TTSRequest(BaseModel):
    model: str = "kokoro"
    input: str
    voice: str = "af_sarah"
    response_format: str = "mp3"
    speed: float = 1.0

@app.post("/v1/audio/speech")
async def text_to_speech(req: TTSRequest):
    voice = VOICE_MAP.get(req.voice, "af_sarah")
    try:
        samples, sample_rate = kokoro.create(
            req.input,
            voice=voice,
            speed=req.speed,
            lang="en-us"
        )
        buf = io.BytesIO()
        sf.write(buf, samples, sample_rate, format="mp3")
        buf.seek(0)
        return StreamingResponse(
            buf,
            media_type="audio/mpeg",
            headers={"Content-Disposition": "attachment; filename=speech.mp3"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health():
    return {"status": "ok", "service": "kokoro-tts", "voices": list(VOICE_MAP.keys())}

@app.get("/v1/models")
async def models():
    return {"data": [{"id": "kokoro", "object": "model"}]}
