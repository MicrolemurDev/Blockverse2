#version 300 es
precision highp float;

uniform sampler2D uSampler;
in vec2 vTexture;
in float vShadow;

out vec4 FragColor;

void main() {
	vec4 color = texture(uSampler, vTexture);
	FragColor = vec4(color.rgb * vShadow, color.a);
	if (FragColor.a == 0.0) discard; // Alpha Test
}