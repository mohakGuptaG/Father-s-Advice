import subprocess
import time
import sys
import signal
import os
import logging
import socket
from datetime import datetime
import platform

# Ensure psutil and requests are installed; if not, instruct the user to install them.
try:
    import psutil
except ImportError:
    sys.exit("Please install psutil using: pip install psutil")

try:
    import requests
except ImportError:
    sys.exit("Please install requests using: pip install requests")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('service_manager.log'),
        logging.StreamHandler()
    ]
)

class ServiceManager:
    def __init__(self):
        self.processes = []
        # Define service order explicitly to ensure correct startup sequence
        self.service_order = ['mentor_processor', 'api', 'workflow', 'algo']
        self.ports = {
            'mentor_processor': 5003,
            'api': 5001,
            'workflow': 5002,
            'algo': 5004
        }
        self.services = {
            'mentor_processor': 'mentor_processor.py',
            'api': 'api.py',
            'workflow': 'workflow.py',
            'algo': 'algo.py'
        }
        # Define service dependencies
        self.dependencies = {
            'mentor_processor': [],
            'api': ['mentor_processor'],
            'workflow': ['mentor_processor', 'api'],
            'algo': ['mentor_processor', 'api', 'workflow']
        }
        # Set Python command based on platform
        self.python_cmd = 'python' if platform.system() == 'Windows' else 'python3'

    def is_port_available(self, port):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('localhost', port))
                return True
        except OSError:
            return False

    def check_service_health(self, service_name, port):
        """
        Check if a service is healthy by making a health check request.
        Retries several times before giving up.
        """
        max_retries = 5
        retry_delay = 2
        for attempt in range(max_retries):
            try:
                response = requests.get(f'http://localhost:{port}/health', timeout=5)
                if response.status_code == 200:
                    health_data = response.json()
                    if health_data.get('status') == 'healthy':
                        logging.info(f"Service {service_name} health check passed on attempt {attempt + 1}")
                        return True
                    else:
                        logging.warning(f"Service {service_name} unhealthy on attempt {attempt + 1}")
                else:
                    logging.warning(f"Service {service_name} returned status {response.status_code} on attempt {attempt + 1}")
            except requests.RequestException as e:
                logging.warning(f"Health check failed for {service_name} on attempt {attempt + 1}: {e}")
            
            if attempt < max_retries - 1:
                logging.info(f"Waiting {retry_delay} seconds before next health check attempt for {service_name}...")
                time.sleep(retry_delay)
        return False

    def kill_existing_processes(self, service_script):
        """Platform-independent way to kill existing processes"""
        killed = False
        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            try:
                cmdline = proc.info['cmdline']
                if cmdline and service_script in ' '.join(cmdline):
                    proc.terminate()
                    proc.wait(timeout=5)  # Wait for process to terminate
                    killed = True
                    logging.info(f"Terminated existing process {proc.info['pid']} for {service_script}")
            except (psutil.NoSuchProcess, psutil.TimeoutExpired):
                continue
        return killed

    def start_services(self):
        try:
            # Create logs directory if it doesn't exist
            if not os.path.exists('logs'):
                os.makedirs('logs')

            # Kill any existing service scripts
            for service_script in self.services.values():
                self.kill_existing_processes(service_script)
            time.sleep(2)  # Allow time for processes to terminate

            # Start services in dependency order
            started_services = set()

            for service_name in self.service_order:
                port = self.ports[service_name]
                if service_name in started_services:
                    continue

                # Check if all dependencies are started
                deps = self.dependencies[service_name]
                if not all(dep in started_services for dep in deps):
                    logging.info(f"Waiting for dependencies {[dep for dep in deps if dep not in started_services]} before starting {service_name}")
                    continue

                # Verify that the port is free
                if not self.is_port_available(port):
                    logging.warning(f"Port {port} is in use, attempting to free it...")
                    # Find and kill processes using the port with psutil
                    killed = False
                    for conn in psutil.net_connections(kind='inet'):
                        if conn.status == 'LISTEN' and conn.laddr.port == port and conn.laddr.ip == '127.0.0.1':
                            try:
                                proc = psutil.Process(conn.pid)
                                proc.terminate()
                                try:
                                    proc.wait(timeout=5)
                                except psutil.TimeoutExpired:
                                    logging.warning(f"Process {proc.pid} did not terminate gracefully, killing it.")
                                    proc.kill()
                                    proc.wait()
                                killed = True
                                logging.info(f"Terminated process {proc.pid} using port {port}.")
                            except (psutil.NoSuchProcess, psutil.AccessDenied) as e:
                                logging.warning(f"Could not terminate process on port {port}: {e}")
                    time.sleep(2)
                    if not self.is_port_available(port):
                        logging.error(f"Failed to free port {port} for {service_name}")
                        return False

                # Use the current working directory instead of __file__
                script_path = os.path.join(os.getcwd(), self.services[service_name])
                if not os.path.exists(script_path):
                    logging.error(f"Service script not found: {script_path}")
                    return False

                # Start the service with output redirection to a log file
                log_file_path = os.path.join('logs', f'{service_name}.log')
                log_file = open(log_file_path, 'w')
                env = os.environ.copy()
                env['PYTHONUNBUFFERED'] = '1'
                env['PORT'] = str(port)  # Set the PORT environment variable

                try:
                    # Use the platform-specific Python command
                    process = subprocess.Popen(
                        [self.python_cmd, script_path],
                        stdout=log_file,
                        stderr=subprocess.STDOUT,
                        env=env,
                        # Add shell=True for Windows to handle Python command properly
                        shell=platform.system() == 'Windows'
                    )
                    self.processes.append((service_name, process, log_file))
                    logging.info(f"Started {service_name} with PID {process.pid}")
                    # Wait for service to start up and become healthy
                    time.sleep(3)
                    if self.check_service_health(service_name, port):
                        logging.info(f"Service {service_name} is healthy on port {port}")
                        started_services.add(service_name)
                    else:
                        if process.poll() is not None:
                            logging.error(f"Service {service_name} process exited with code {process.poll()}")
                            log_file.flush()
                            with open(log_file_path, 'r') as f:
                                log_content = f.read()
                                logging.error(f"Service {service_name} log content:\n{log_content}")
                        else:
                            logging.error(f"Service {service_name} failed health check on port {port}")
                        return False
                except Exception as e:
                    logging.error(f"Error starting {service_name}: {e}")
                    return False

            return True
        except Exception as e:
            logging.error(f"Error in start_services: {e}")
            return False

    def stop_services(self):
        logging.info("Shutting down services...")
        # Stop services in reverse order of dependency start
        for service_name, process, log_file in reversed(self.processes):
            try:
                logging.info(f"Stopping {service_name} with PID {process.pid}...")
                process.terminate()
                process.wait(timeout=5)
                log_file.close()
                logging.info(f"Successfully stopped {service_name}")
            except subprocess.TimeoutExpired:
                logging.warning(f"Force stopping {service_name} with PID {process.pid}...")
                process.kill()
            except Exception as e:
                logging.error(f"Error stopping {service_name}: {e}")

def main():
    service_manager = ServiceManager()

    def signal_handler(signum, frame):
        logging.info("Received shutdown signal")
        service_manager.stop_services()
        sys.exit(0)

    # Register signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    if service_manager.start_services():
        logging.info("All services are running successfully!")
        for service, port in service_manager.ports.items():
            logging.info(f"- {service}: http://localhost:{port}")
        logging.info("Press Ctrl+C to stop all services.")
        logging.info("Logs are available in the 'logs' directory.")

        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            signal_handler(signal.SIGINT, None)
    else:
        logging.error("Failed to start all services. Check the logs for details.")
        sys.exit(1)

if __name__ == '__main__':
    main()