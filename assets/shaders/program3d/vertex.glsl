#version 300 es

in vec3  aVertex;
in vec2  aTexture;
in float aShadow;
    
out vec2  vTexture;
out float vShadow;
out float vFog;
    
uniform mat4 uView;
uniform float uDist;
uniform vec3 uPos;

void main() {
	vTexture = aTexture;
	vShadow = aShadow > 0.0 ? aShadow : 1.0;
	gl_Position = uView * vec4( aVertex, 1.0);

	float range = max(uDist / 5.0, 8.0);
	vFog = clamp((length(uPos.xz - aVertex.xz) - uDist + range) / range, 0.0, 1.0);
}