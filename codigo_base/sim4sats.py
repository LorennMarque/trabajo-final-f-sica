import numpy as np
import pandas as pd
from math import sqrt
# ──────────────────────────────────────────────────────────────
#  CONSTANTES
# ──────────────────────────────────────────────────────────────
M_TIERRA   = 5.97e24            # kg
G          = 6.67430e-11        # N·m²/kg²
C          = 299_792_458        # m/s  (velocidad de la luz)

# ──────────────────────────────────────────────────────────────
#  ÓRBITA KEPLERIANA SIMPLE CON RK-4
# ──────────────────────────────────────────────────────────────
def calculo_orbita_RK_3D(m1, radio, start_pos, pasos=10000, dt=1.0):
    """Devuelve un DataFrame con columnas t, x, y, z para un satélite."""
    x0, y0, z0 = start_pos
    r0 = sqrt(x0**2 + y0**2 + z0**2)
    v0 = sqrt(G * m1 / r0)                 # velocidad circular

    # Vector inicial de velocidad (perpendicular al radio)
    if x0 or y0:       vx, vy, vz = -y0,  x0, 0
    else:              vx, vy, vz =  0 , -z0, y0
    nrm = sqrt(vx**2 + vy**2 + vz**2)
    vx, vy, vz = (vx/nrm*v0, vy/nrm*v0, vz/nrm*v0)

    y = np.array([x0, vx, y0, vy, z0, vz])   # estado [x vx y vy z vz]

    def F(state):
        x, vx, y_, vy, z, vz = state
        r = sqrt(x*x + y_*y_ + z*z)
        a = -G*m1 / r**3
        return np.array([vx, a*x, vy, a*y_, vz, a*z])

    def rk4_step(state, h):
        k1 = F(state)
        k2 = F(state + 0.5*h*k1)
        k3 = F(state + 0.5*h*k2)
        k4 = F(state + h*k3)
        return state + h*(k1 + 2*k2 + 2*k3 + k4)/6

    registros, t = [], 0.0
    for _ in range(pasos):
        registros.append({'t':t, 'x':y[0], 'y':y[2], 'z':y[4]})
        y = rk4_step(y, dt)
        t += dt
    return pd.DataFrame(registros)

# ──────────────────────────────────────────────────────────────
#  ESTIMACIÓN GPS CON 4 SATÉLITES (x, y, z, sesgo de reloj)
# ──────────────────────────────────────────────────────────────
def posicion_4sats_con_error(df, t, x_real, y_real, z_real,
                             error_oscilador=1e-7):
    """
    Devuelve posición estimada y sesgo Δt (en segundos) usando 4 satélites.
    El receptor REAL está en (x_real, y_real, z_real)—solo para simular.
    """
    # ─── 1. Posiciones de los 4 satélites en el instante t ─────────────
    fila = df[df["t"] == t]
    if fila.empty:
        raise ValueError(f"No hay datos para t = {t}")
    sats = [np.array(fila[[f"{c}{i}" for c in "xyz"]].iloc[0])
            for i in (1,2,3,4)]                                    # p1..p4

    # ─── 2. Pseudodistancias (ρ) con error realista ───────────────────
    rcv        = np.array([x_real, y_real, z_real])
    bias       = np.random.uniform(-error_oscilador, error_oscilador) * C  # m
    pseudorange= []
    for p in sats:
        d_true = np.linalg.norm(rcv - p)                 # distancia real
        pseudorange.append(d_true + bias)        # ρ_i = d_i + cΔt + ε

    # ─── 3. Resolución por mínimos cuadrados iterativos ───────────────
    #     Desconocidos: (x, y, z, b) con b en metros (b = cΔt)
    x, y, z, b = 0., 0., 0., 0.                          # semilla
    for _ in range(10):                                  # ~10 iteraciones bastan
        H, res = [], []
        for p, ρ in zip(sats, pseudorange):
            dx, dy, dz = x - p[0], y - p[1], z - p[2]
            r_hat = sqrt(dx*dx + dy*dy + dz*dz)
            res.append(ρ - (r_hat + b))                  # ρ - (r + b)
            H.append([-dx/r_hat, -dy/r_hat, -dz/r_hat, -1.0])
        H, res = np.array(H), np.array(res)
        delta   = np.linalg.lstsq(H, res, rcond=None)[0]
        x, y, z, b = x+delta[0], y+delta[1], z+delta[2], b+delta[3]
        if np.linalg.norm(delta[:3]) < 1e-4:             # 0.1 mm de tolerancia
            break
    return np.array([x, y, z]), b/C                     # posición, Δt (s)

# ──────────────────────────────────────────────────────────────
#  SIMULACIÓN
# ──────────────────────────────────────────────────────────────
radio = 26_600_000        # ~órbita MEO (m)

# satélites en 4 fases distintas
s1 = ( radio,      0,      0)
s2 = (     0, radio,      0)
s3 = (     0,      0, radio)
s4 = (-radio/sqrt(2),  radio/sqrt(2), 0)   # cuarto satélite

pasos = 6000               # ≈ una hora con dt=1 s
df1 = calculo_orbita_RK_3D(M_TIERRA, radio, s1, pasos)
df2 = calculo_orbita_RK_3D(M_TIERRA, radio, s2, pasos)
df3 = calculo_orbita_RK_3D(M_TIERRA, radio, s3, pasos)
df4 = calculo_orbita_RK_3D(M_TIERRA, radio, s4, pasos)

# juntar los 4 satélites por la columna 't'
df = df1.merge(df2, on="t", suffixes=("1", "2"))
df = df.merge(df3, on="t")
df.rename(columns={"x":"x3", "y":"y3", "z":"z3"}, inplace=True)
df = df.merge(df4, on="t", suffixes=("", "4"))
df.rename(columns={"x":"x4", "y":"y4", "z":"z4"}, inplace=True)

# ─── Ejemplo de posicionamiento en t = 500 s ──────────────────────────
pos, dt_bias = posicion_4sats_con_error(df, t=500, x_real=0, y_real=0, z_real=0)
print("Posición estimada (m):", pos)
print("Sesgo de reloj Δt (s):", dt_bias)
print("Error (m):", np.linalg.norm(pos))
