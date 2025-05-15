import numpy as np
import pandas as pd
from math import sqrt, pi
import matplotlib.pyplot as plt

m_tierra = 5.97e24
grav_const = 6.67430e-11
v_luz = 2.998e8

def calculo_orbita_RK_3D(m1, radio, start_pos, pasos=10000):
    x0, y0, z0 = start_pos
    r = sqrt(x0**2 + y0**2 + z0**2)
    v0 = sqrt(grav_const * m1 / r)

    # Vector perpendicular para velocidad inicial (unitario)
    if x0 != 0 or y0 != 0:
        vx = -y0
        vy = x0
        vz = 0
    else:
        vx = 0
        vy = -z0
        vz = y0

    norm = sqrt(vx**2 + vy**2 + vz**2)
    vx = vx / norm * v0
    vy = vy / norm * v0
    vz = vz / norm * v0

    y = np.array([x0, vx, y0, vy, z0, vz])
    dt = 1

    resultados = []

    def F(y, t):
        x, vx, y_, vy, z, vz = y
        r = sqrt(x**2 + y_**2 + z**2)
        a = -grav_const * m1 / r**3
        return np.array([vx, a * x, vy, a * y_, vz, a * z])

    def RK4(y, t, dt):
        k1 = F(y, t)
        k2 = F(y + 0.5 * k1 * dt, t + 0.5 * dt)
        k3 = F(y + 0.5 * k2 * dt, t + 0.5 * dt)
        k4 = F(y + k3 * dt, t + dt)
        return dt * (k1 + 2*k2 + 2*k3 + k4) / 6

    tiempo_actual = 0
    for _ in range(pasos):
        resultados.append({
            't': tiempo_actual,
            'x': y[0],
            'y': y[2],
            'z': y[4]
        })
        y += RK4(y, tiempo_actual, dt)
        tiempo_actual += dt

    return pd.DataFrame(resultados)

def calcular_posicion_3D(df, t, x, y, z):
    fila = df[df["t"] == t]

    p1 = np.array([fila["x1"].iloc[0], fila["y1"].iloc[0], fila["z1"].iloc[0]])
    p2 = np.array([fila["x2"].iloc[0], fila["y2"].iloc[0], fila["z2"].iloc[0]])
    p3 = np.array([fila["x3"].iloc[0], fila["y3"].iloc[0], fila["z3"].iloc[0]])

    d1 = np.linalg.norm(np.array([x, y, z]) - p1)
    d2 = np.linalg.norm(np.array([x, y, z]) - p2)
    d3 = np.linalg.norm(np.array([x, y, z]) - p3)

    r1 = d1
    r2 = d2
    r3 = d3

    # Vectores base
    ex = (p2 - p1)
    ex = ex / np.linalg.norm(ex)
    i = np.dot(ex, p3 - p1)
    temp = p3 - p1 - i * ex
    ey = temp / np.linalg.norm(temp)
    ez = np.cross(ex, ey)

    d = np.linalg.norm(p2 - p1)
    j = np.dot(ey, p3 - p1)

    x_val = (r1**2 - r2**2 + d**2) / (2 * d)
    y_val = (r1**2 - r3**2 + i**2 + j**2 - 2 * i * x_val) / (2 * j)
    
    try:
        z_val = sqrt(abs(r1**2 - x_val**2 - y_val**2))  # puede dar dos soluciones
    except ValueError:
        print("No hay intersección real")
        return None

    # Primera solución
    sol1 = p1 + x_val * ex + y_val * ey + z_val * ez
    # Segunda solución (reflejada)
    sol2 = p1 + x_val * ex + y_val * ey - z_val * ez

    return sol1, sol2


# --------- Simulación ----------
radio = 26600000

# Posiciones iniciales en diferentes fases o planos
s1 = (radio, 0, 0)
s2 = (0, radio, 0)
s3 = (0, 0, radio)

df1 = calculo_orbita_RK_3D(m_tierra, radio, s1)
df2 = calculo_orbita_RK_3D(m_tierra, radio, s2)
df3 = calculo_orbita_RK_3D(m_tierra, radio, s3)

# Fusionar por tiempo
df = df1.merge(df2, on="t", suffixes=("1", "2"))
df = df.merge(df3, on="t")
df.rename(columns={"x": "x3", "y": "y3", "z": "z3"}, inplace=True)

# Ejemplo: verificar si puede triangular (posición del receptor)
posicion_receptor = calcular_posicion_3D(df, 500, 0, 0, 0)
print("Posición triangulada:", posicion_receptor)
