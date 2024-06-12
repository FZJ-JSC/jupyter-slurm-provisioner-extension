try:
    from ._version import __version__
except ImportError:
    # Fallback when using the package in dev mode without installing
    # in editable mode with pip. It is highly recommended to install
    # the package from a stable release or in editable mode: https://pip.pypa.io/en/stable/topics/local-project-installs/#editable-installs
    import warnings

    warnings.warn("Importing 'jupyter_slurm_provisioner_extension' outside a proper installation.")
    __version__ = "dev"
from .handlers import setup_handlers, setup_kernel


def _jupyter_labextension_paths():
    return [{
        "src": "labextension",
        "dest": "jupyter-slurm-provisioner-extension"
    }]


def _jupyter_server_extension_points():
    return [{
        "module": "jupyter_slurm_provisioner_extension"
    }]


def _load_jupyter_server_extension(server_app):
    """Registers the API handler to receive HTTP requests from the frontend extension.

    Parameters
    ----------
    server_app: jupyter_server.serverapp.ServerApp
        JupyterLab application instance
    """
    setup_kernel()
    setup_handlers(server_app.web_app)

    name = "jupyter_slurm_provisioner_extension"
    server_app.log.info(f"Registered {name} server extension")
