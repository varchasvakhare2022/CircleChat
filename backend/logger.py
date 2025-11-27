"""
Logging configuration for CircleChat backend
"""
import logging
import sys
from datetime import datetime

# Configure logging format
LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

def setup_logger(name: str = "CircleChat", level: int = logging.INFO) -> logging.Logger:
    """
    Set up and configure a logger instance
    
    Args:
        name: Logger name
        level: Logging level (default: INFO)
    
    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(name)
    logger.setLevel(level)
    
    # Avoid adding multiple handlers
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(level)
        formatter = logging.Formatter(LOG_FORMAT, DATE_FORMAT)
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    
    return logger

# Default logger instance
logger = setup_logger()

def get_logger(name: str = None) -> logging.Logger:
    """
    Get a logger instance with the specified name
    
    Args:
        name: Optional logger name (default: uses module name)
    
    Returns:
        Logger instance
    """
    if name:
        return setup_logger(name)
    import inspect
    frame = inspect.currentframe().f_back
    module_name = frame.f_globals.get('__name__', 'CircleChat')
    return setup_logger(module_name)

