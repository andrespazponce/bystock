from pathlib import Path
import environ

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(DEBUG=(bool, False))

# Carga .env desde la raíz del proyecto si existe (útil fuera de Docker)
env_file = BASE_DIR.parent / '.env'
if env_file.exists():
    environ.Env.read_env(str(env_file), overwrite=False)

# --- Seguridad ---
SECRET_KEY = env('SECRET_KEY')
DEBUG = env('DEBUG')
ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=['localhost', '127.0.0.1'])

# --- Aplicaciones ---
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Terceros
    'rest_framework',
    'corsheaders',
    'django_filters',
    'axes',
    # Locales
    'core',
    'accounts',
    'gobierno',
    'reuniones',
    'activos',
    'finanzas',
]

MIDDLEWARE = [
    # CorsMiddleware debe ir antes de CommonMiddleware
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'core.middleware.CurrentUserMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    # AxesMiddleware debe ir al final, después de AuthenticationMiddleware.
    'axes.middleware.AxesMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# --- Base de datos ---
DATABASES = {
    'default': env.db('DATABASE_URL')
}

# --- Modelo de usuario personalizado ---
AUTH_USER_MODEL = 'accounts.CustomUser'

# --- Validadores de contraseña ---
# Se aplican al crear/cambiar contraseñas (incluido el cambio desde el portal).
# Sin esto, Django acepta cualquier cadena: rechazamos las demasiado cortas,
# las muy comunes, las puramente numéricas y las parecidas a los datos del usuario.
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {'min_length': 8},
    },
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# --- Internacionalización ---
LANGUAGE_CODE = 'es-ar'
TIME_ZONE = 'America/Argentina/Buenos_Aires'
USE_I18N = True
USE_TZ = True

# --- Archivos estáticos ---
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# --- Archivos subidos (media) ---
# Carpeta NO pública: Django no la sirve a menos que se cablee en urls.py.
# La descarga segura (autenticada) se hará en una fase posterior.
MEDIA_ROOT = env('MEDIA_ROOT', default=str(BASE_DIR / 'media'))
MEDIA_URL = '/media/'

# Límite de tamaño de subida para documentos (en MB).
MAX_UPLOAD_SIZE_MB = env.int('MAX_UPLOAD_SIZE_MB', default=20)
# Extensiones permitidas para documentos del portal.
DOCUMENTO_EXTENSIONES_PERMITIDAS = env.list(
    'DOCUMENTO_EXTENSIONES_PERMITIDAS',
    default=['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png'],
)

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# --- CORS ---
CORS_ALLOWED_ORIGINS = env.list('CORS_ALLOWED_ORIGINS', default=[])
CORS_ALLOW_CREDENTIALS = True

# --- Django REST Framework ---
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    # Filtros declarativos en los list endpoints (?organo=...&estado=...).
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.OrderingFilter',
    ],
    # Paginación por defecto: listas grandes no devuelven todo de golpe.
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
}

# --- SimpleJWT ---
from datetime import timedelta
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# --- IA: Anthropic Claude ---
# ANTHROPIC_API_KEY se carga desde .env (NUNCA se hardcodea aquí).
# Si no está definida, la extracción IA devolverá 500 con mensaje claro.
ANTHROPIC_API_KEY = env('ANTHROPIC_API_KEY', default='')
# Modelo a usar; se puede sobreescribir por entorno sin tocar código.
ANTHROPIC_MODEL = env('ANTHROPIC_MODEL', default='claude-opus-4-7')

# --- Autenticación + bloqueo por intentos fallidos (django-axes) ---
# AxesStandaloneBackend debe ir PRIMERO para interceptar y bloquear antes de
# que el backend normal valide las credenciales.
AUTHENTICATION_BACKENDS = [
    'axes.backends.AxesStandaloneBackend',
    'django.contrib.auth.backends.ModelBackend',
]

AXES_ENABLED = env.bool('AXES_ENABLED', default=True)
AXES_FAILURE_LIMIT = 5                       # bloquea tras 5 fallos
AXES_COOLOFF_TIME = timedelta(hours=1)       # se desbloquea solo tras 1 hora
# Bloquea por la COMBINACIÓN email + IP (no solo por email, para que un atacante
# no pueda dejar afuera a un usuario legítimo a propósito).
AXES_LOCKOUT_PARAMETERS = [['username', 'ip_address']]
# Nuestro login usa email como campo de usuario (USERNAME_FIELD = 'email').
AXES_USERNAME_FORM_FIELD = 'email'
# Un login exitoso limpia el contador de fallos de esa combinación.
AXES_RESET_ON_SUCCESS = True
