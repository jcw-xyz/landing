var vert = `
		precision highp float;

    // attributes, in
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute vec2 aTexCoord;

    // attributes, out
    varying vec3 var_vertPos;
    varying vec3 var_vertNormal;
    varying vec2 var_vertTexCoord;
		varying vec4 var_centerGlPosition;//原点
    
    // matrices
    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;
    uniform mat3 uNormalMatrix;
		uniform float u_time;


    void main() {
      vec3 pos = aPosition;
			vec4 posOut = uProjectionMatrix * uModelViewMatrix * vec4(pos, 1.0);
      gl_Position = posOut;

      // set out value
      var_vertPos      = pos;
      var_vertNormal   =  aNormal;
      var_vertTexCoord = aTexCoord;
			var_centerGlPosition = uProjectionMatrix * uModelViewMatrix * vec4(0., 0., 0.,1.0);
    }
`;

var frag = `

precision highp float;

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;

vec3 rotate(vec3 p, float angle, vec3 axis){
    vec3 a = normalize(axis);
    float s = sin(angle);
    float c = cos(angle);
    float r = 1.0 - c;
    mat3 m = mat3(
        a.x * a.x * r + c,
        a.y * a.x * r + a.z * s,
        a.z * a.x * r - a.y * s,
        a.x * a.y * r - a.z * s,
        a.y * a.y * r + c,
        a.z * a.y * r + a.x * s,
        a.x * a.z * r + a.y * s,
        a.y * a.z * r - a.x * s,
        a.z * a.z * r + c
    );
    return m * p;
}


vec3 opTwist( vec3 p, float k)
{
    float c = cos(k*p.y);
    float s = sin(k*p.y);
    mat2  m = mat2(c,-s,s,c);
    vec3  q = vec3(m*p.xz,p.y);
    return q;
}

//Torus
float sdTorus( vec3 p, vec2 t )
{    
  vec2 q = vec2(length(p.xz)-t.x,p.y);
  return length(q)-t.y;
}

vec3 getTorusNormal(vec3 p, vec2 t)
{
    float ep = 0.0001;
    return normalize(vec3(
        sdTorus(p, t) - sdTorus(vec3(p.x - ep, p.y, p.z), t),
        sdTorus(p, t) - sdTorus(vec3(p.x, p.y - ep, p.z), t),
        sdTorus(p, t) - sdTorus(vec3(p.x, p.y, p.z - ep), t)
    ));
}


//combined Function
float dist_func(vec3 p)
{
	//twistTest
    vec3  pt = opTwist(p,15.0*sin(u_time));
    vec3 rpt = rotate(pt, sin(u_time)*3.5, vec3(1.0, 0.0, 0.0));
	float trusDist = sdTorus(rpt, vec2(0.3, 0.15));
    return trusDist;
}

vec3 getNormal(vec3 pos)
{
    float ep = 0.0001;
    return normalize(vec3(
        dist_func(pos) - dist_func(vec3(pos.x - ep, pos.y, pos.z)),
        dist_func(pos) - dist_func(vec3(pos.x, pos.y - ep, pos.z)),
        dist_func(pos) - dist_func(vec3(pos.x, pos.y, pos.z - ep))
    ));
}

//texture

float random (in vec2 st) {
    highp float a = 12.9898;
    highp float b = 78.233;
    highp float c = 43758.5453;
    highp float dt= dot(st.xy ,vec2(a,b));
    highp float sn= mod(dt,3.14);
    return fract(sin(sn) * c);
}

float noise(vec2 st) {
    vec2 i = vec2(0.);
		i = floor(st);
    vec2 f = vec2(0.);
		f = fract(st);
    vec2 u =  vec2(0.);
		u = f*f*(3.0-2.0*f);
    return mix( mix( random( i + vec2(0.0,0.0) ),
                     random( i + vec2(1.0,0.0) ), u.x),
                mix( random( i + vec2(0.0,1.0) ),
                     random( i + vec2(1.0,1.0) ), u.x), u.y);
}

//variables
vec3 lightDir = normalize(vec3(0.0,1.0,-1.0));
vec3 bgCol = vec3(0.10,0.12,0.18);
vec3 objCol = vec3(1.0,1.0,1.0);


float grid(vec2 uv, float num)
{
    float w = 0.2;
    uv *= num;
    uv = fract(uv);
    float v = uv.x >= 0.5-w*0.5 && uv.x < 0.5+w*0.5 || uv.y >= 0.5-w*0.5 && uv.y < 0.5+w*0.5 ? 1. : 0.;
    return v;
}


void main() {
	
   vec2 pos = (gl_FragCoord.xy*2.0 - u_resolution.xy)/min(u_resolution.x,u_resolution.y);
    float noise = noise((pos)*1000.);
    vec3 col = bgCol;

    vec3 cameraPos = vec3(0.0, 0.0, 10.0);
    vec3 rayDir = normalize(vec3(pos, 0.0) - cameraPos);
    vec3 currentPos = cameraPos;
    
   for(int i = 0; i < 50; i++){
       float d = dist_func(currentPos);
       if (d < 0.005)
       {
       	vec3 normal = getNormal(currentPos);
           float diff = dot(normal, lightDir);
           diff = (diff / 2.0) + 0.6;
           float noisedDiff = step(noise,diff);
           col = objCol * noisedDiff + (1.0-noisedDiff) * (objCol-0.1);
           col *= diff+0.3;
           break;
       }
       currentPos += rayDir * d;
   }
    //col += noise*0.2;

    gl_FragColor = vec4(col, 1);

}

`;

let sh;

function setup() {
  createCanvas(windowWidth, windowHeight / 1.8, WEBGL);

  //shader
  sh = createShader(vert, frag);
  this.shader(sh);
  pixelDensity(1);
  sh.setUniform("u_resolution", [width, height]);
  noStroke();
}

function draw() {
  sh.setUniform("u_time", millis() / 1000);
  rect(-width / 2, -height / 2, width, height);
}
