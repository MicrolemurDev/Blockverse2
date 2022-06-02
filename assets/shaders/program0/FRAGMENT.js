export const PLATFORM = 'WEBGL2';
export const SHADER_TYPE = 'FRAGMENT';
export const SOURCE = `#version 300 es
precision highp float;

uniform sampler2D uSampler;
in float vShadow;
in vec2  vTexture;
in float vFog;
in vec3  vFogColor;

out vec4 FragColor;
    
vec4 fog(vec4 color) {
	color.r += (vFogColor.r - color.r) * vFog; // R
	color.g += (vFogColor.g - color.g) * vFog; // G
	color.b += (vFogColor.b - color.b) * vFog; // B
	return color;
} // Fog is hardcoded: remove me later

void main(){
	vec4 color = texture(uSampler, vTexture);
	FragColor = fog(vec4(color.rgb * vShadow, color.a));
	if (FragColor.a == 0.0) discard; // Alpha Test
}`;