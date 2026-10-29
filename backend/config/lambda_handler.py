"""AWS Lambda entry point: adapts Function URL events to the Django WSGI app."""

from apig_wsgi import make_lambda_handler

from config.wsgi import application

handler = make_lambda_handler(application, binary_support=True)
