export default function WizardHat({ size = 38, style: extStyle = {} }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 44"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", overflow: "visible", flexShrink: 0, ...extStyle }}
    >
      {/* Ground glow shadow */}
      <ellipse cx="20" cy="40" rx="11" ry="2.2" fill="#c89010">
        <animate attributeName="opacity" values="0.06;0.2;0.06" dur="2.5s" repeatCount="indefinite" />
      </ellipse>

      {/* Main hat — bobs up and down */}
      <g>
        <animateTransform
          attributeName="transform" type="translate"
          values="0,0; 0,-2; 0,0" dur="3s" repeatCount="indefinite"
          calcMode="spline" keySplines="0.45 0 0.55 1; 0.45 0 0.55 1"
        />

        {/* Cone body */}
        <polygon points="20,3 7,31 33,31" fill="#1a0840" stroke="#c89018" strokeWidth="0.9" strokeLinejoin="round" />
        {/* Left-face shadow for depth */}
        <polygon points="20,3 7,31 20,31" fill="#0b0220" opacity="0.5" />
        {/* Inner magic pulse */}
        <polygon points="20,3 7,31 33,31" fill="#7030b8">
          <animate attributeName="opacity" values="0;0.07;0" dur="2.5s" repeatCount="indefinite" />
        </polygon>

        {/* Gold band */}
        <rect x="8" y="27" width="24" height="4" rx="1.8" fill="#c89010" />
        {/* Band highlight streak */}
        <rect x="8" y="27" width="24" height="1.6" rx="1.8" fill="#f0d060" opacity="0.38" />

        {/* Centre gem on band */}
        <circle cx="20" cy="29" r="2.1" fill="#f0d050">
          <animate attributeName="r"       values="2.1;2.7;2.1" dur="1.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.65;1;0.65"  dur="1.5s" repeatCount="indefinite" />
        </circle>
        <circle cx="20" cy="29" r="0.75" fill="#fff" opacity="0.7" />

        {/* Brim */}
        <ellipse cx="20" cy="31" rx="13.5" ry="3.4" fill="#1e0840" stroke="#c89018" strokeWidth="0.85" />
        {/* Brim inner highlight */}
        <ellipse cx="20" cy="30.5" rx="11.5" ry="2" fill="#32126a" opacity="0.55" />

        {/* Hat tip glow */}
        <circle cx="20" cy="4" r="2.4" fill="#e8c060">
          <animate attributeName="opacity" values="0.3;0.85;0.3" dur="1.9s" repeatCount="indefinite" />
          <animate attributeName="r"       values="2.4;3.4;2.4"  dur="1.9s" repeatCount="indefinite" />
        </circle>

        {/* Rune star on hat face */}
        <text
          x="20" y="21" textAnchor="middle" dominantBaseline="middle"
          fontSize="9" fill="#f0d060"
          style={{ userSelect: "none", fontFamily: "serif" }}
        >
          ✦
          <animate attributeName="opacity" values="0.25;0.95;0.25" dur="2.2s" repeatCount="indefinite" />
        </text>
      </g>

      {/* Twinkling sparkles at fixed positions — staggered fade in/out */}
      <circle cx="8"  cy="13" r="1.4" fill="#f0d050">
        <animate attributeName="opacity" values="0;1;0"   dur="2s"   begin="0s"   repeatCount="indefinite" />
        <animate attributeName="r"       values="1.4;0.7;1.4" dur="2s" begin="0s" repeatCount="indefinite" />
      </circle>
      <circle cx="32" cy="11" r="1.1" fill="#c0a0ff">
        <animate attributeName="opacity" values="0;1;0"   dur="2.4s" begin="0.7s" repeatCount="indefinite" />
        <animate attributeName="r"       values="1.1;0.5;1.1" dur="2.4s" begin="0.7s" repeatCount="indefinite" />
      </circle>
      <circle cx="37" cy="22" r="0.9" fill="#f0e060">
        <animate attributeName="opacity" values="0;0.8;0" dur="1.7s" begin="1.3s" repeatCount="indefinite" />
      </circle>
      <circle cx="3"  cy="23" r="1.1" fill="#a060ff">
        <animate attributeName="opacity" values="0;0.9;0" dur="2.2s" begin="0.4s" repeatCount="indefinite" />
        <animate attributeName="r"       values="1.1;0.5;1.1" dur="2.2s" begin="0.4s" repeatCount="indefinite" />
      </circle>
      <circle cx="22" cy="0.5" r="1" fill="#f0e880">
        <animate attributeName="opacity" values="0;1;0"   dur="1.5s" begin="1s"   repeatCount="indefinite" />
        <animate attributeName="r"       values="1;1.8;1"   dur="1.5s" begin="1s"   repeatCount="indefinite" />
      </circle>
    </svg>
  );
}
