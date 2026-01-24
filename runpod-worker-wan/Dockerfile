FROM nvidia/cuda:12.6.3-cudnn-runtime-ubuntu24.04

ARG COMFYUI_VERSION=latest

ENV DEBIAN_FRONTEND=noninteractive \
    PIP_PREFER_BINARY=1 \
    PYTHONUNBUFFERED=1 \
    CMAKE_BUILD_PARALLEL_LEVEL=8

RUN apt-get update && apt-get install -y \
    python3.12 \
    python3.12-venv \
    git \
    wget \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    ffmpeg \
    && ln -sf /usr/bin/python3.12 /usr/bin/python \
    && ln -sf /usr/bin/pip3 /usr/bin/pip \
    && apt-get autoremove -y \
    && apt-get clean -y \
    && rm -rf /var/lib/apt/lists/*

RUN wget -qO- https://astral.sh/uv/install.sh | sh \
    && ln -s /root/.local/bin/uv /usr/local/bin/uv \
    && ln -s /root/.local/bin/uvx /usr/local/bin/uvx \
    && uv venv /opt/venv

ENV PATH="/opt/venv/bin:${PATH}"

RUN uv pip install comfy-cli pip setuptools wheel

RUN /usr/bin/yes | comfy --workspace /comfyui install --version "${COMFYUI_VERSION}" --nvidia

WORKDIR /comfyui

RUN git clone https://github.com/city96/ComfyUI-GGUF /comfyui/custom_nodes/ComfyUI-GGUF \
    && uv pip install -r /comfyui/custom_nodes/ComfyUI-GGUF/requirements.txt

RUN git clone https://github.com/kijai/ComfyUI-WanVideoWrapper /comfyui/custom_nodes/ComfyUI-WanVideoWrapper \
    && if [ -f /comfyui/custom_nodes/ComfyUI-WanVideoWrapper/requirements.txt ]; then \
         uv pip install -r /comfyui/custom_nodes/ComfyUI-WanVideoWrapper/requirements.txt; \
       fi

RUN mkdir -p /comfyui/models/diffusion_models /comfyui/models/loras /comfyui/models/text_encoders /comfyui/models/vae

COPY models/unet/wan2.2_i2v_high_noise_14B_Q4_K_M.gguf /comfyui/models/diffusion_models/
COPY models/unet/wan2.2_i2v_low_noise_14B_Q4_K_M.gguf /comfyui/models/diffusion_models/
COPY models/loras/Wan2.2-Lightning_I2V-A14B-4steps-lora_HIGH_fp16.safetensors /comfyui/models/loras/
COPY models/loras/Wan2.2-Lightning_I2V-A14B-4steps-lora_LOW_fp16.safetensors /comfyui/models/loras/
COPY ["models/loras/NSFW-22-H-e8 (1).safetensors", "/comfyui/models/loras/"]
COPY models/loras/WAN-2.2-I2V-BreastPlay-HIGH-v2.safetensors /comfyui/models/loras/
COPY models/loras/reverse_suspended_congress_I2V_high.safetensors /comfyui/models/loras/
COPY models/loras/wan22_i2v_anal_v1_high_noise.safetensors /comfyui/models/loras/
COPY models/loras/wan22.r3v3rs3_c0wg1rl-14b-High-i2v_e70.safetensors /comfyui/models/loras/
COPY models/loras/wan22-ultimatedeepthroat-i2v-102epoc-high-k3nk.safetensors /comfyui/models/loras/
COPY models/loras/wan2.2_i2v_highnoise_pov_missionary_v1.0.safetensors /comfyui/models/loras/
COPY ["models/loras/st0m4chBulg3_FUSED_HN (1).safetensors", "/comfyui/models/loras/"]
COPY models/loras/wan2.2-i2v-high-pov-insertion-v1.0.safetensors /comfyui/models/loras/
COPY models/loras/wan2.2-i2v-low-pov-insertion-v1.0.safetensors /comfyui/models/loras/
COPY models/loras/Sensual_fingering_v1_low_noise.safetensors /comfyui/models/loras/
COPY models/text_encoders/umt5-xxl-enc-bf16.safetensors /comfyui/models/text_encoders/
COPY models/vae/wan_2.1_vae.safetensors /comfyui/models/vae/

WORKDIR /

RUN uv pip install runpod requests websocket-client

COPY handler.py /handler.py
COPY start.sh /start.sh
RUN chmod +x /start.sh

RUN rm -rf /comfyui/custom_nodes/ComfyUI-Manager

CMD ["/start.sh"]
