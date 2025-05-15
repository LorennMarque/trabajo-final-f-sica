import numpy as np
from math import sqrt, pi
import pandas as pd
import matplotlib.pyplot as plt

m_tierra = 5.97 * 10**24
grav_const = 6.67430 / 10**11
v_luz = 2.998 * 10**2

def calculo_orbita_RK_2D(m1, radio, start_x, pasos=10000):
    v_inicial = sqrt(grav_const*m1/radio)
    periodo = 2 * pi * radio / v_inicial
    start_y = sqrt(radio**2 - start_x**2)
    vx = v_inicial * (start_y / radio)
    vy = v_inicial * (start_x / radio)
    y = np.array([start_x, vx, start_y, vy])
    dt = 1
    
    resultados = []
    
    def F(y, t):
        factor = (-grav_const * m1) / (y[0]**2 + y[2]**2)
        return np.array([
            y[1],
            factor * y[0] / sqrt(y[0]**2 + y[2]**2),
            y[3],
            factor * y[2] / sqrt(y[0]**2 + y[2]**2)
        ])
    
    def RK4(y, t, dt):
        k1 = F(y, t)
        k2 = F(y + 0.5*k1*dt, t + 0.5*dt)
        k3 = F(y + 0.5*k2*dt, t + 0.5*dt)
        k4 = F(y + k3*dt, t + dt)
        return dt * (k1 + 2*k2 + 2*k3 + k4) / 6
    
    tiempo_actual = 0
    for paso in range(pasos):
        resultados.append({
            't': tiempo_actual,
            'x': y[0],
            'y': y[2],
        })
        
        y += RK4(y, tiempo_actual, dt)
        tiempo_actual += dt
    
    df_orbita = pd.DataFrame(resultados)
    
    return df_orbita

def calcular_posision_2D(df, t, x, y):
    fila = df[df["t"] == t]

    x1, y1 = float(fila["x1"].iloc[0]), float(fila["y1"].iloc[0])
    x2, y2 = float(fila["x2"].iloc[0]), float(fila["y2"].iloc[0])

    d1 = sqrt((x - x1)**2 + (y - y1)**2)
    d2 = sqrt((x - x2)**2 + (y - y2)**2)

    tiempo_1 = d1/v_luz
    tiempo_2 = d2/v_luz

    dx = x2 - x1
    dy = y2 - y1
    dist_sats = sqrt(dx**2 + dy**2)

    ex = dx / dist_sats
    ey = dy / dist_sats

    a = (d1**2 - d2**2 + dist_sats**2) / (2 * dist_sats)

    try:
        h = sqrt(d1**2 - a**2)
    except ValueError:
        print("No hay intersección real entre los círculos (error numérico)")
        return None

    # Vector perpendicular a e_x
    perp_ex = -ey
    perp_ey = ex

    # Punto base P2
    px = x1 + a * ex
    py = y1 + a * ey

    # Dos puntos de intersección
    inter1 = (px + h * perp_ex, py + h * perp_ey)
    inter2 = (px - h * perp_ex, py - h * perp_ey)

    return inter1, inter2

d1 = 26600000
x1 = 0
x2 = d1

df1 = calculo_orbita_RK_2D(m_tierra, d1, x1)
df2 = calculo_orbita_RK_2D(m_tierra, d1, x2)

df = pd.merge(df1,df2, on = "t", suffixes=("1", "2"))

print(calcular_posision_2D(df, 500, 0,0))


