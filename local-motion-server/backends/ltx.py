"""LTX-Video image-to-video (Lightricks, open weights). Fast: ~5 s clip in a few minutes on a 12-16 GB GPU.
Model: https://huggingface.co/Lightricks/LTX-Video  (check its licence before monetising)."""
import os

import torch
from diffusers import LTXImageToVideoPipeline
from diffusers.utils import export_to_video

from backends.common import NEGATIVE, fit_image, step_callback

MODEL_ID = os.environ.get("LTX_MODEL", "Lightricks/LTX-Video")
SEGMENT_SECONDS = 5.0
FPS = 24
STEPS = int(os.environ.get("LTX_STEPS", "40"))
PIPE = None


def load(device):
    global PIPE
    bf16 = device == "cuda" and torch.cuda.is_bf16_supported()
    dtype = torch.bfloat16 if bf16 else (torch.float16 if device == "cuda" else torch.float32)
    PIPE = LTXImageToVideoPipeline.from_pretrained(MODEL_ID, torch_dtype=dtype)
    if device == "cuda":
        vram = torch.cuda.get_device_properties(0).total_memory / 2**30
        if vram < 20:
            PIPE.enable_model_cpu_offload()  # 12-16 GB cards (Kaggle / Colab T4)
        else:
            PIPE.to("cuda")
        PIPE.vae.enable_tiling()
    else:
        PIPE.to("cpu")


def animate(image, prompt, negative, out, width=0, height=0, seed=0, progress=lambda p: None):
    im, W, H = fit_image(image, int(os.environ.get("LTX_SIZE", "768")), 32, width, height)
    frames = int(SEGMENT_SECONDS * FPS) // 8 * 8 + 1  # LTX: 8k + 1 frames
    g = torch.Generator(device="cpu").manual_seed(seed or 42)
    video = PIPE(image=im, prompt=prompt, negative_prompt=negative or NEGATIVE, width=W, height=H, num_frames=frames,
                 num_inference_steps=STEPS, generator=g, callback_on_step_end=step_callback(STEPS, progress)).frames[0]
    export_to_video(video, out, fps=FPS)
