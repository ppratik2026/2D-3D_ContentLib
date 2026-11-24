"""Wan 2.1 image-to-video 480p (Alibaba, Apache-2.0). Better motion and faces than LTX, but slow and needs a big GPU
(24 GB+; works on 16 GB only very slowly with offloading). Model: https://huggingface.co/Wan-AI/Wan2.1-I2V-14B-480P-Diffusers"""
import os

import torch
from diffusers import AutoencoderKLWan, WanImageToVideoPipeline
from diffusers.utils import export_to_video
from transformers import CLIPVisionModel

from backends.common import NEGATIVE, fit_image, step_callback

MODEL_ID = os.environ.get("WAN_MODEL", "Wan-AI/Wan2.1-I2V-14B-480P-Diffusers")
SEGMENT_SECONDS = 5.0
FPS = 16
STEPS = int(os.environ.get("WAN_STEPS", "30"))
PIPE = None


def load(device):
    global PIPE
    dtype = torch.bfloat16 if device == "cuda" and torch.cuda.is_bf16_supported() else torch.float16
    image_encoder = CLIPVisionModel.from_pretrained(MODEL_ID, subfolder="image_encoder", torch_dtype=torch.float32)
    vae = AutoencoderKLWan.from_pretrained(MODEL_ID, subfolder="vae", torch_dtype=torch.float32)
    PIPE = WanImageToVideoPipeline.from_pretrained(MODEL_ID, vae=vae, image_encoder=image_encoder, torch_dtype=dtype)
    if device == "cuda":
        PIPE.enable_model_cpu_offload()


def animate(image, prompt, negative, out, width=0, height=0, seed=0, progress=lambda p: None):
    im, W, H = fit_image(image, 832, 16, width, height)
    frames = int(SEGMENT_SECONDS * FPS) // 4 * 4 + 1  # Wan: 4k + 1 frames
    g = torch.Generator(device="cpu").manual_seed(seed or 42)
    video = PIPE(image=im, prompt=prompt, negative_prompt=negative or NEGATIVE, height=H, width=W, num_frames=frames,
                 guidance_scale=5.0, num_inference_steps=STEPS, generator=g, callback_on_step_end=step_callback(STEPS, progress)).frames[0]
    export_to_video(video, out, fps=FPS)
