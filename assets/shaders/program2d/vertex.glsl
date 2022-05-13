#version 300 es

in vec2 aVertex;
in vec2 aTexture;
in float aShadow;

out vec2 vTexture;
out float vShadow;

void main() {
	vTexture = aTexture;
	vShadow = aShadow;
	gl_Position = vec4(aVertex, 0.5, 1.0);
}