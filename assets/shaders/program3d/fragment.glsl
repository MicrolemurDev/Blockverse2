#version 300 es

precision highp float;

uniform sampler2D uSampler;
in float vShadow;
in vec2 vTexture;
in float vFog;

out vec4 FragColor;
    
vec4 fog(vec4 color) {
	color.r += (0.33 - color.r) * vFog;
	color.g += (0.54 - color.g) * vFog;
	color.b += (0.72 - color.b) * vFog;
	return color;
}

void main(){
	vec4 color = texture(uSampler, vTexture);
	FragColor = fog(vec4(color.rgb * vShadow, color.a));
	if (FragColor.a == 0.0) discard; // Alpha Test
}