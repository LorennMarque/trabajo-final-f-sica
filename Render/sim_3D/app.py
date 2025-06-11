from flask import Flask, render_template, jsonify, request, send_from_directory
import pandas as pd
import numpy as np
import os
import sys

# Add the current directory to the Python path
sys.path.append(os.path.dirname(__file__))
from codigo_base.sim3D import calcular_posicion_3D

app = Flask(__name__, 
           template_folder='Render',
           static_folder='Render',
           static_url_path='')

# Cargar los datos de órbita una sola vez al iniciar la aplicación
try:
    df = pd.read_csv('orbitas_3D.csv')
except FileNotFoundError:
    print("Error: No se encuentra el archivo orbitas_3D.csv")
    print("Directorio actual:", os.getcwd())
    print("Archivos en el directorio:", os.listdir())
    sys.exit(1)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/calculate_position', methods=['POST'])
def calculate_position():
    try:
        data = request.json
        if not data:
            return jsonify({
                'success': False,
                'error': 'No se recibieron datos'
            }), 400

        x = float(data.get('x', 0))
        y = float(data.get('y', 0))
        z = float(data.get('z', 0))
        t = float(data.get('t', 0))
        
        # Asegurarse de que t existe en el DataFrame
        if t not in df['t'].values:
            closest_t = df['t'].iloc[(df['t'] - t).abs().argsort()[0]]
            print(f"Tiempo {t} no encontrado, usando el más cercano: {closest_t}")
            t = closest_t

        # Calcular las dos posibles soluciones
        result = calcular_posicion_3D(df, t, x, y, z)
        
        return jsonify({
            'success': True,
            'solution1': result['solutions'][0].tolist(),
            'solution2': result['solutions'][1].tolist(),
            'distances': result['distances'],
            'satellites': [sat.tolist() for sat in result['satellites']]
        })
    except Exception as e:
        print(f"Error en calculate_position: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/orbitas_3D.csv')
def serve_csv():
    return send_from_directory(os.path.dirname(__file__), 'orbitas_3D.csv')

if __name__ == '__main__':
    print("Servidor iniciando...")
    print("Directorio actual:", os.getcwd())
    print("Archivos en el directorio:", os.listdir())
    print("Rutas estáticas:", app.static_folder)
    app.run(debug=True)
