# Shader Format (Blockverse INDEV_3+) (WIP)
A new shader format is now bundled with the game as of ```INDEV_3```. This format is built in the following:
- `PLATFORM`: For now, set this export to `WEBGL` or `WEBGL2` for the only renderer that is currently bundled with the game. However, if WebGPU were to be supported, it would likely be called with `WEBGPU`.
- `SHADER_TYPE`: Either `VERTEX` or `FRAGMENT` depending on what you need.
- `SOURCE`: This is the source code of the shader.