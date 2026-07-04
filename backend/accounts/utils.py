def get_client_ip(request):
    """Devuelve la IP del cliente.

    En producción detrás de Traefik/nginx, el proxy agrega la cabecera
    X-Forwarded-For con la IP real del cliente (la primera de la lista). En
    desarrollo o sin proxy, usamos REMOTE_ADDR.

    Nota de seguridad: X-Forwarded-For es falsificable si NO hay un proxy de
    confianza al frente. Al desplegar, hay que asegurarse de que solo el proxy
    de confianza pueda fijar esa cabecera.
    """
    if request is None:
        return None
    xff = request.META.get('HTTP_X_FORWARDED_FOR')
    if xff:
        return xff.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')
