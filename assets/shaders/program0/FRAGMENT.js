export const PLATFORM = 'WEBGL2';
export const SHADER_TYPE = 'FRAGMENT';
export const SOURCE = `#version 300 es
precision highp float;

uniform sampler2D uSampler; // ???
uniform float     uSkyLight; // Sky Light Level for Calculation
uniform vec3      uFogColor; // Fog Color Uniform

in float vShadow; // Vertex Shadow Level to make smooth
in float vLightValue; // WIP Light Value of block
in vec2  vTexture; // Texture Atlas Coords
in float vFog; // Fog Level

out vec4 FragColor; // This is the Fragment Color, in place of gl_FragColor
    
vec4 fog(vec4 color) {
	color.r += (uFogColor.r - color.r) * vFog; // R
	color.g += (uFogColor.g - color.g) * vFog; // G
	color.b += (uFogColor.b - color.b) * vFog; // B
	return color;
}

void main(){
	vec4 color = texture(uSampler, vTexture);
	FragColor = fog(vec4(color.rgb * vShadow, color.a));
	if (FragColor.a == 0.0) discard; // Alpha Test
}`;