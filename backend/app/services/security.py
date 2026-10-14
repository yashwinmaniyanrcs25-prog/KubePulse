import re
import socket
import ipaddress
from urllib.parse import urlparse
from typing import Optional
from app.config import settings

# RFC 1123 label regex for Kubernetes resource names
DNS_1123_REGEX = re.compile(r"^[a-z0-9]([-a-z0-9]*[a-z0-9])?$")

# OCI / Docker image reference regex (allows registry host:port, path, name, tag and digest)
# Disallows shell metacharacters, spaces, quotes, backticks, flags
DOCKER_IMAGE_REGEX = re.compile(
    r"^([a-zA-Z0-9]+([._-][a-zA-Z0-9]+)*(:[0-9]+)?/)?"  # optional registry host(:port)/
    r"([a-z0-9]+([._-][a-z0-9]+)*/)*"                  # optional repository path/
    r"([a-z0-9_-]+)"                                    # image name
    r"(:[a-zA-Z0-9_.-]+)?"                              # optional :tag
    r"(@sha256:[a-fA-F0-9]{64})?$"                      # optional @digest
)

# Forbidden internal domains / host suffixes
FORBIDDEN_DOMAIN_SUFFIXES = [
    ".localhost",
    ".local",
    ".internal",
    ".svc",
    ".cluster.local",
    ".localdomain",
    "metadata.google.internal",
    "instance-data",
]

def validate_dns_name(name: str) -> str:
    """
    Validates that a string is a valid Kubernetes RFC 1123 DNS subdomain label.
    Must be lowercase alphanumeric and hyphens, max 63 characters, start and end with alphanumeric.
    """
    if not name or not isinstance(name, str):
        raise ValueError("Application name must be a non-empty string.")
    
    clean_name = name.strip()
    if len(clean_name) > 63:
        raise ValueError(f"Application name '{clean_name}' exceeds maximum length of 63 characters.")
    
    if not DNS_1123_REGEX.match(clean_name):
        raise ValueError(
            f"Invalid application name '{clean_name}'. Must contain only lowercase alphanumeric characters or '-', "
            "and must start and end with an alphanumeric character (RFC 1123)."
        )
    
    return clean_name


def validate_docker_image(image_ref: str) -> str:
    """
    Validates that an image reference is a valid Docker/OCI image string
    and does not contain malicious command injections, shell characters, or flags.
    """
    if not image_ref or not isinstance(image_ref, str):
        raise ValueError("Docker image reference must be a non-empty string.")
    
    clean_ref = image_ref.strip()
    
    # Check for disallowed characters
    disallowed_chars = [" ", ";", "&", "|", "`", "$", "(", ")", "<", ">", "\n", "\r", "\\", '"', "'"]
    for ch in disallowed_chars:
        if ch in clean_ref:
            raise ValueError(f"Invalid character '{ch}' in Docker image reference.")
    
    # Disallow flags starting with '-'
    if clean_ref.startswith("-"):
        raise ValueError("Docker image reference cannot start with a hyphen/flag.")
    
    if not DOCKER_IMAGE_REGEX.match(clean_ref):
        raise ValueError(
            f"Invalid Docker image reference '{clean_ref}'. Must follow standard format like 'nginx:alpine', "
            "'ghcr.io/org/repo:1.0', or 'docker.io/library/redis:latest'."
        )
    
    return clean_ref


def is_ip_private_or_restricted(ip_str: str) -> bool:
    """
    Determines if an IP address string is loopback, private, link-local, multicast, or reserved.
    """
    try:
        ip = ipaddress.ip_address(ip_str)
        return (
            ip.is_loopback
            or ip.is_private
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        )
    except ValueError:
        return True


def validate_safe_url(url_str: str, allow_custom_ports: bool = True) -> str:
    """
    Validates a URL against Server-Side Request Forgery (SSRF).
    Enforces HTTP/HTTPS scheme, blocks localhost/internal hostnames, and resolves
    DNS to guarantee target IP does not belong to private/loopback/cloud-metadata networks.
    """
    if not url_str or not isinstance(url_str, str):
        raise ValueError("URL must be a non-empty string.")
    
    clean_url = url_str.strip()
    try:
        parsed = urlparse(clean_url)
    except Exception as e:
        raise ValueError(f"Malformed URL: {e}")
    
    # 1. Enforce scheme
    if parsed.scheme.lower() not in ("http", "https"):
        raise ValueError(f"Invalid URL scheme '{parsed.scheme}'. Only 'http' and 'https' are allowed.")
    
    hostname = parsed.hostname
    if not hostname:
        raise ValueError("URL must contain a valid hostname.")
    
    hostname_lower = hostname.lower()
    
    # 2. Block direct localhost / loopback string names
    if hostname_lower in ("localhost", "127.0.0.1", "::1", "0.0.0.0"):
        raise ValueError("SSRF Protection: Access to localhost or loopback addresses is forbidden.")
    
    # 3. Block known internal domain suffixes
    for suffix in FORBIDDEN_DOMAIN_SUFFIXES:
        if hostname_lower == suffix.lstrip(".") or hostname_lower.endswith(suffix):
            raise ValueError(f"SSRF Protection: Access to internal or cluster domain '{hostname}' is forbidden.")
    
    # 4. Block cloud metadata endpoints
    if hostname_lower in ("169.254.169.254", "metadata", "instance-data"):
        raise ValueError("SSRF Protection: Access to cloud metadata service is strictly forbidden.")
    
    # 5. Resolve DNS and check all resolved IPs
    try:
        addr_info = socket.getaddrinfo(hostname, None)
        resolved_ips = set()
        for item in addr_info:
            ip_candidate = item[4][0]
            resolved_ips.add(ip_candidate)
            if is_ip_private_or_restricted(ip_candidate):
                raise ValueError(
                    f"SSRF Protection: Host '{hostname}' resolves to restricted/private IP '{ip_candidate}'. "
                    "Access to private, loopback, or cloud-internal networks is blocked."
                )
    except socket.gaierror as ge:
        raise ValueError(f"Unable to resolve hostname '{hostname}': {ge}")
    
    return clean_url


def validate_target_namespace(namespace: Optional[str] = None) -> str:
    """
    Enforces namespace isolation. Restricts workloads to the dedicated
    application namespace (default: settings.TARGET_NAMESPACE).
    Rejects system and sensitive cluster namespaces.
    """
    target = (namespace or settings.TARGET_NAMESPACE).strip().lower()
    
    # Forbidden system namespaces
    forbidden_namespaces = {
        "kube-system",
        "kube-public",
        "kube-node-lease",
        "default",
    }
    
    if target in forbidden_namespaces:
        raise ValueError(
            f"Deployment into restricted cluster namespace '{target}' is forbidden. "
            f"Deployments must target the dedicated namespace '{settings.TARGET_NAMESPACE}'."
        )
    
    return target
