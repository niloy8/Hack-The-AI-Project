from fastapi import FastAPI, File, UploadFile
import whisper
from tempfile import NamedTemporaryFile
import uvicorn

app = FastAPI()
model = whisper.load_model("base")

@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    print(file)
    content = await file.read()

    with NamedTemporaryFile(suffix=".mpga", delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name 

    result = model.transcribe(tmp_path)
    
    print(result['segments'])

    return {"text": result["text"],
            "segments" : result['segments']
            }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
