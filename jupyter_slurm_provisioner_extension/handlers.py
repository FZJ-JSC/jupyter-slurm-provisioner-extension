import base64
import json
import os
import shutil

from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join

from tornado import web
from tornado.httpclient import AsyncHTTPClient
from tornado.httpclient import HTTPRequest


current_config_file = f"{os.environ.get('HOME', '')}/.local/share/jupyter/kernels/slurm-provisioner-kernel/kernel.json"
current_config = [0, {}]
allocations_file = f"{os.environ.get('HOME', '')}/.local/share/jupyter/runtime/slurm_provisioner.json"
allocations = [0, {}]

def get_current_config(logger):
    try:
        last_edit = os.stat(current_config_file).st_mtime
        if last_edit > current_config[0]:
            current_config[0] = last_edit
            with open(current_config_file, "r") as f:
                kernel_json = json.load(f)
            current_config[1] = kernel_json.get("metadata", {}).get("kernel_provisioner", {}).get("config", {})
    except Exception:
        logger.exception("Could not read slurm-provisioner-kernel/kernel.json file")
    return current_config[1]

def get_allocations(logger):
    try:
        last_edit = os.stat(allocations_file).st_mtime
        if last_edit > allocations[0]:
            allocations[0] = last_edit
            with open(allocations_file, "r") as f:
                allocations[1] = json.load(f)
    except Exception:
        logger.exception("Could not read runtime/slurm_provisioner.json file")
    return allocations[1]

class UpdateLocalFiles(APIHandler):
    @web.authenticated
    async def get(self):
        body = {
            "current_config": get_current_config(self.log),
            "allocations": get_allocations(self.log)
        }
        self.finish(json.dumps(body))


class UpdateAll(APIHandler):
    @web.authenticated
    async def get(self):
        headers = {
            "Authorization": self.request.headers.get("Authorization")
        }

        servername = os.environ.get("JUPYTERHUB_SERVER_NAME", None)
        username = os.environ.get("JUPYTERHUB_USER", None)
        api_url = os.environ.get("JUPYTERHUB_API_URL", f"{self.request.protocol}://{self.request.host}/hub/api").rstrip("/")
        url = f"{api_url}/users/{username}/servers/{servername}/optionsform"

        # Receive current options form for this user + system
        req = HTTPRequest(
            url=url,
            method="GET",
            headers=headers,
            validate_cert=False,
        )
        http_client = AsyncHTTPClient()
        try:
            resp = await http_client.fetch(req)
            if resp.body:
                body = json.loads(resp.body.decode('utf8', 'replace'))
            else:
                body = {}
        except Exception as e:
            self.log.exception("Slurmel: Could not receive OptionsForm information")
            body = {}
        
        body["allocations"] = get_allocations(self.log)
        body["current_config"] = get_current_config(self.log)
        body["documentationhref"] = os.environ.get("SLURMEL_DOCUMENTATION_HREF", "slurmeldocumentation")
        self.finish(json.dumps(body))

class ConfigureHandler(APIHandler):    
    @web.authenticated
    async def post(self):
        # load current json kernel file
        home = os.environ.get("HOME", "").rstrip("/")
        kernel_path = f"{home}/.local/share/jupyter/kernels/slurm-provisioner-kernel"
        with open(f"{kernel_path}/kernel.json", "r") as f:
            kernel = json.load(f)
        
        if self.request.body:
            new_config = json.loads(self.request.body.decode('utf8', 'replace'))
        else:
            self.log.error("Slurmel: No body sent")
            self.set_status(400)
            return
        kernel["metadata"]["kernel_provisioner"]["config"] = new_config
        with open(f"{kernel_path}/kernel.json", "w") as f:
            f.write(json.dumps(kernel, indent=4, sort_keys=True))
        self.set_status(200)

def default_kernel():
    return {
        "display_name": "Slurm Wrapper",
        "language": "python",
        "metadata": {
            "debugger": True,
            "kernel_provisioner": {
                "config": {},
                "provisioner_name": "slurm-provisioner"
            }
        }
    }

def default_logos():
    logo32b64 = "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAEMAAABDAGWp/hQAAAAGXRFWHRTb2Z0d2FyZQB3d3cuaW5rc2NhcGUub3Jnm+48GgAABH5JREFUWIWtl29ollUYxq/7effPLQuXTm1WJH7SMkRpH4r+qCCYsahMTWwqsT4IQdbHitF/EcwPZbhKJOrLQlPQoH8WOBVFiGmWVKxwE5ab2nLT+Tznvq4+vG573+15p7zrwOG87zmc+/qd69zncB7DGGXp5gN1ENY4wwKR0+k+RSRJP0/3biePu5KtR9555vRYccYqVmjgsS0H6t21i64OMtSIrKQ7SAdJ0B0iQYbLSvDIkfdWHysGICo0ENwaRJ6aOPPCLFNYNiisnJrtU6VbeL0YcQAoKTjCUE3qlgu/l0+2oFnSoCgxCsY5+38HIGkk7zTPdFHpwkN9zoJOFg0AajvoXw2LK7vv0mskK/NgxGL1swCN24+XdvZdWi/nEtFvp7v5oIATokMiJIH0MqW4UDTA8paWzNmO/i/grNdgho9KtGybLzrcN54SDXROXiaG+vQMH9nHUTCSAEFFO+ABK8bKcOZUjXBBGtJtL9oBifPHzPAc4TyY4cQTMthStAOk16Yl1bDFbCd1MXsaBMkhCoBBwF8wNLd98Pw3RQOILE3bW5JnIK49snn1D6kzJVu05/zHgJ7EtuIBbPEb+ztJr5XnZLx7bEjua920pi1t0uI9XfeEOPozKrVeAF5S6ZPi/rK7fnyi+udCQup5sRZxNA0RY0ztP23WnABABLFtZIaT/LqQ+MMt56ZRmRNRia0y06sGeyVcLlkXmZ98YN8/kwou1aMXEOE4EJ1AV+VFnd2wEgCiEHhgZIaDPJUWY+Ge7uZMGR4CbKfAY5K9KeitKOIhg+0oi+PFC/d0Nxc2HAADwKQKCp+o49naKBPwmcgLuRlOeZI212htoPUDWguL6gz60My2kdH9gtbDMr1GS3UOYikYI6dWwrkq+v7t+r8ZWO/yX3KPW25Z0tJbvWh3TwMj1TASAdsJ8ahgKyWtAHXYYDsAzzBSzaLdPQ1LWnqr87cguRdMACUAh+qDJQDQuunpVgBz5r78adXNVzJlXlExkDu3rzxOKhzBgOmg3QFTg0XRIUiCmRBZnaB1Eg6ZYTqg3/rK4yEX1bFhKRgvhAKgkN2GbDu34ItosDy8t3sBqJCRzUAUtXvm6rkJmfK47lh1X1OTEQCamhR9O6+nqjRKyjNeXgNypps6p5RcntAy7925UNgM+sQUgCvXBRirqOul5wA0Arg1byArkIHCVDBU5InmA/QVfg9cV3zjegAf5XcShcU8DeBM0QCANeaLDwb2kSJpwtnWw8FxAGDGNeUbE5OP7ovw+XgACqz2BhwQAWifzTk8DgfSVxtDYe/wnifDUPDs2YcSCD/hprL3gbEepdcFiNMACPnF7P8kK+oOWPyrzT64NS1M8QBDq8sDqIBC47XfCZRcgrwa1HcAUgGKfs+DcRhxtwOKh69ZJY9igtUC+gOGUCjMOACSozl3ek69BgNWIVwpA1AKoOB3Y/EAcdgIxidHucAkm+Xkl7hacg5AOwYGNhUKM76r+NTyMkT/PgUkj4NhPuS3AUgA6wR0FLJduLt1v1nhZ/t/Rx2bsma2S4EAAAAASUVORK5CYII="
    logo64b64 = "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"
    svgb64 = "PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjxzdmcKICAgd2lkdGg9IjQ1MCIKICAgaGVpZ2h0PSI0NTAiCiAgIHZlcnNpb249IjEuMSIKICAgaWQ9InN2Zzg0MiIKICAgc29kaXBvZGk6ZG9jbmFtZT0iU2x1cm1fbG9nby5zdmciCiAgIGlua3NjYXBlOnZlcnNpb249IjEuMS4yIChiOGUyNWJlODMzLCAyMDIyLTAyLTA1KSIKICAgeG1sbnM6aW5rc2NhcGU9Imh0dHA6Ly93d3cuaW5rc2NhcGUub3JnL25hbWVzcGFjZXMvaW5rc2NhcGUiCiAgIHhtbG5zOnNvZGlwb2RpPSJodHRwOi8vc29kaXBvZGkuc291cmNlZm9yZ2UubmV0L0RURC9zb2RpcG9kaS0wLmR0ZCIKICAgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiCiAgIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIKICAgeG1sbnM6c3ZnPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPGRlZnMKICAgICBpZD0iZGVmczg0NiI+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQ2ODkiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQxNDc4IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEuNzIwMTI3OSwwLDAsMS43MzY3MzQ3LC00NS44Mzk2LC0zNS43ODMzMDgpIgogICAgICAgeDE9IjI2LjY0ODkzNyIKICAgICAgIHkxPSIyMC42MDM3ODEiCiAgICAgICB4Mj0iMTM1LjY2NTI1IgogICAgICAgeTI9IjExNC4zOTc2NyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDY4OSI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM1YTlmZDQ7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wNDY5MSIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzMwNjk5ODtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3A0NjkzIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDY3MSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDE0NzUiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMS43MTY2MzMyLDAsMCwxLjczMzIwNjMsNjUuMDM2ODg1LDcxLjMyNjA1MikiCiAgICAgICB4MT0iMTUwLjk2MTExIgogICAgICAgeTE9IjE5Mi4zNTE3NiIKICAgICAgIHgyPSIxMTIuMDMxNDQiCiAgICAgICB5Mj0iMTM3LjI3Mjk5IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0NjcxIj4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmZDQzYjtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3A0NjczIiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmZlODczO3N0b3Atb3BhY2l0eToxIgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wNDY3NSIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgPC9kZWZzPgogIDxzb2RpcG9kaTpuYW1lZHZpZXcKICAgICBpZD0ibmFtZWR2aWV3ODQ0IgogICAgIHBhZ2Vjb2xvcj0iI2ZmZmZmZiIKICAgICBib3JkZXJjb2xvcj0iIzY2NjY2NiIKICAgICBib3JkZXJvcGFjaXR5PSIxLjAiCiAgICAgaW5rc2NhcGU6cGFnZXNoYWRvdz0iMiIKICAgICBpbmtzY2FwZTpwYWdlb3BhY2l0eT0iMC4wIgogICAgIGlua3NjYXBlOnBhZ2VjaGVja2VyYm9hcmQ9IjAiCiAgICAgc2hvd2dyaWQ9ImZhbHNlIgogICAgIGlua3NjYXBlOnpvb209IjEuNTM1MTg1MiIKICAgICBpbmtzY2FwZTpjeD0iMjk0Ljc1MjcxIgogICAgIGlua3NjYXBlOmN5PSIyNDkuMTU1NjEiCiAgICAgaW5rc2NhcGU6d2luZG93LXdpZHRoPSIxOTIwIgogICAgIGlua3NjYXBlOndpbmRvdy1oZWlnaHQ9IjEwNTEiCiAgICAgaW5rc2NhcGU6d2luZG93LXg9Ii05IgogICAgIGlua3NjYXBlOndpbmRvdy15PSItOSIKICAgICBpbmtzY2FwZTp3aW5kb3ctbWF4aW1pemVkPSIxIgogICAgIGlua3NjYXBlOmN1cnJlbnQtbGF5ZXI9InN2Zzg0MiIgLz4KICA8ZwogICAgIGlkPSJnMTQyMSI+CiAgICA8cGF0aAogICAgICAgZmlsbD0iIzQyYWZlYiIKICAgICAgIGQ9Im0gMjE3Ljc5MjA5LDE3My4wNTk2NCBjIC0zLjkxMjk0LDAgLTcuMDg0MDEsMy4xNDgzOSAtNy4wODQwMSw3LjAzMzMyIHYgMCAxMy41MzczOSBjIDAsMy44ODIyIDMuMTcxMDcsNy4wMzQzNiA3LjA4NDAxLDcuMDM0MzYgdiAwIGggMTQuMDcwMzkgYyAzLjkxMjk1LDAgNy4wODkxNywtMy4xNTIxNiA3LjA4OTE3LC03LjAzNDM2IHYgMCAtMTMuNTM3MzkgYyAwLC0zLjg4NDkzIC0zLjE3NjIyLC03LjAzMzMyIC03LjA4OTE3LC03LjAzMzMyIHYgMCB6IG0gMzQuNTg0MzQsMjEuNDE5OTggYyAtMi45MzkxOSwwIC01LjMyMjgzLDIuNDA3NyAtNS4zMjI4Myw1LjM2OTczIHYgMCAxMC4zMzAwNyBjIDAsMi45NjUwOSAyLjM4MzY0LDUuMzcxMSA1LjMyMjgzLDUuMzcxMSB2IDAgaCAxMC41NzE1MSBjIDIuOTM5NTMsMCA1LjMyMTExLC0yLjQwNjAxIDUuMzIxMTEsLTUuMzcxMSB2IDAgLTEwLjMzMDA3IGMgMCwtMi45NjIwMyAtMi4zODE1OCwtNS4zNjk3MyAtNS4zMjExMSwtNS4zNjk3MyB2IDAgeiBtIC02NS42NzAxMiwwIGMgLTIuOTM4MTcsMCAtNS4zMjIxNiwyLjQwNzcgLTUuMzIyMTYsNS4zNjk3MyB2IDAgMTAuMzMwMDcgYyAwLDIuOTY1MDkgMi4zODM5OSw1LjM3MTEgNS4zMjIxNiw1LjM3MTEgdiAwIGggMTAuNTcwOCBjIDIuOTM3ODEsMCA1LjMyMjgzLC0yLjQwNjAxIDUuMzIyODMsLTUuMzcxMSB2IDAgLTEwLjMzMDA3IGMgMCwtMi45NjIwMyAtMi4zODUwMiwtNS4zNjk3MyAtNS4zMjI4MywtNS4zNjk3MyB2IDAgeiBtIDMxLjA4NTc4LDExLjg0ODc1IGMgLTMuOTEyOTQsMCAtNy4wODQwMSwzLjE0NjY4IC03LjA4NDAxLDcuMDM0MDMgdiAwIDEzLjUzNjM0IGMgMCwzLjg4NDI1IDMuMTcxMDcsNy4wMzUzOCA3LjA4NDAxLDcuMDM1MzggdiAwIGggMTQuMDcwMzkgYyAzLjkxMjk1LDAgNy4wODkxNywtMy4xNTExMyA3LjA4OTE3LC03LjAzNTM4IHYgMCAtMTMuNTM2MzQgYyAwLC0zLjg4NzM1IC0zLjE3NjIyLC03LjAzNDAzIC03LjA4OTE3LC03LjAzNDAzIHYgMCB6IG0gNjEuNzc4OTQsNi4zNDYxIGMgLTIuMTg1OTIsMCAtMy45NTc3OSwxLjc4NzYzIC0zLjk1Nzc5LDMuOTk1MjcgdiAwIDcuNjg0NiBjIDAsMi4yMDI4NCAxLjc3MTg3LDMuOTkxODQgMy45NTc3OSwzLjk5MTg0IHYgMCBoIDcuODY0NTMgYyAyLjE4NDU2LDAgMy45NTc4LC0xLjc4OSAzLjk1NzgsLTMuOTkxODQgdiAwIC03LjY4NDYgYyAwLC0yLjIwNzY0IC0xLjc3MzI0LC0zLjk5NTI3IC0zLjk1NzgsLTMuOTk1MjcgdiAwIHogbSAtMTE3LjAwNDg2LDAgYyAtMi4xODUyOCwwIC0zLjk1OTE5LDEuNzg3NjMgLTMuOTU5MTksMy45OTUyNyB2IDAgNy42ODQ2IGMgMCwyLjIwMjg0IDEuNzczOTEsMy45OTE4NCAzLjk1OTE5LDMuOTkxODQgdiAwIGggNy44NjIwOCBjIDIuMTg4MDIsMCAzLjk1OTg3LC0xLjc4OSAzLjk1OTg3LC0zLjk5MTg0IHYgMCAtNy42ODQ2IGMgMCwtMi4yMDc2NCAtMS43NzE4NSwtMy45OTUyNyAtMy45NTk4NywtMy45OTUyNyB2IDAgeiBtIDg5LjgxMDI2LDguMDg3ODMgYyAtMi45MzkxOSwwIC01LjMyMjgzLDIuNDAzOTQgLTUuMzIyODMsNS4zNjYzIHYgMCAxMC4zMzM0OSBjIDAsMi45NjI3MSAyLjM4MzY0LDUuMzY3NjYgNS4zMjI4Myw1LjM2NzY2IHYgMCBoIDEwLjU3MTUxIGMgMi45Mzk1MywwIDUuMzIxMTEsLTIuNDA0OTUgNS4zMjExMSwtNS4zNjc2NiB2IDAgLTEwLjMzMzQ5IGMgMCwtMi45NjIzNiAtMi4zODE1OCwtNS4zNjYzIC01LjMyMTExLC01LjM2NjMgdiAwIHogbSAtNjUuNjcwMTIsMCBjIC0yLjkzODE3LDAgLTUuMzIyMTYsMi40MDM5NCAtNS4zMjIxNiw1LjM2NjMgdiAwIDEwLjMzMzQ5IGMgMCwyLjk2MjcxIDIuMzgzOTksNS4zNjc2NiA1LjMyMjE2LDUuMzY3NjYgdiAwIGggMTAuNTcwOCBjIDIuOTM3ODEsMCA1LjMyMjgzLC0yLjQwNDk1IDUuMzIyODMsLTUuMzY3NjYgdiAwIC0xMC4zMzM0OSBjIDAsLTIuOTYyMzYgLTIuMzg1MDIsLTUuMzY2MyAtNS4zMjI4MywtNS4zNjYzIHYgMCB6IG0gOTIuODY0NzIsMTMuMDE3MzIgYyAtMi4xODU5MiwwIC0zLjk1Nzc5LDEuNzg2NTkgLTMuOTU3NzksMy45OTE0OSB2IDAgNy42ODQ5NCBjIDAsMi4yMDMxOSAxLjc3MTg3LDMuOTkyNTIgMy45NTc3OSwzLjk5MjUyIHYgMCBoIDcuODY0NTMgYyAyLjE4NDU2LDAgMy45NTc4LC0xLjc4OTMzIDMuOTU3OCwtMy45OTI1MiB2IDAgLTcuNjg0OTQgYyAwLC0yLjIwNDkgLTEuNzczMjQsLTMuOTkxNDkgLTMuOTU3OCwtMy45OTE0OSB2IDAgeiBtIC0xMTcuMDA0ODYsMCBjIC0yLjE4NTI4LDAgLTMuOTU5MTksMS43ODY1OSAtMy45NTkxOSwzLjk5MTQ5IHYgMCA3LjY4NDk0IGMgMCwyLjIwMzE5IDEuNzczOTEsMy45OTI1MiAzLjk1OTE5LDMuOTkyNTIgdiAwIGggNy44NjIwOCBjIDIuMTg4MDIsMCAzLjk1OTg3LC0xLjc4OTMzIDMuOTU5ODcsLTMuOTkyNTIgdiAwIC03LjY4NDk0IGMgMCwtMi4yMDQ5IC0xLjc3MTg1LC0zLjk5MTQ5IC0zLjk1OTg3LC0zLjk5MTQ5IHYgMCB6IG0gNTUuMjI1OTIsNS41MjggYyAtMy45MTI5NCwwIC03LjA4NDAxLDMuMTQ5NzUgLTcuMDg0MDEsNy4wMzUwNSB2IDAgMTMuNTM3MzYgYyAwLDMuODg0NjIgMy4xNzEwNyw3LjAzMTk5IDcuMDg0MDEsNy4wMzE5OSB2IDAgaCAxNC4wNzAzOSBjIDMuOTEyOTUsMCA3LjA4OTE3LC0zLjE0NzM3IDcuMDg5MTcsLTcuMDMxOTkgdiAwIC0xMy41MzczNiBjIDAsLTMuODg1MyAtMy4xNzYyMiwtNy4wMzUwNSAtNy4wODkxNywtNy4wMzUwNSB2IDAgeiBtIDg1LjAyMDU3LDUuNzgzNTkgYyAtMS42MjU1NSwwIC0yLjk0MDU3LDEuMzI4NTQgLTIuOTQwNTcsMi45NjUwOCB2IDAgNS43MDQ0MyBjIDAsMS42MzY1NCAxLjMxNTAyLDIuOTYyNzIgMi45NDA1NywyLjk2MjcyIHYgMCBIIDMwOC42NSBjIDEuNjIwNzIsMCAyLjkzNDY5LC0xLjMyNjE4IDIuOTM0NjksLTIuOTYyNzIgdiAwIC01LjcwNDQzIGMgMCwtMS42MzY1NCAtMS4zMTM5NywtMi45NjUwOCAtMi45MzQ2OSwtMi45NjUwOCB2IDAgeiBtIC0xNjEuNDU5NTUsMCBjIC0xLjYyMzE3LDAgLTIuOTM4MTYsMS4zMjg1NCAtMi45MzgxNiwyLjk2NTA4IHYgMCA1LjcwNDQzIGMgMCwxLjYzNjU0IDEuMzE0OTksMi45NjI3MiAyLjkzODE2LDIuOTYyNzIgdiAwIGggNS44MzQ5MSBjIDEuNjI0MTgsMCAyLjkzODg1LC0xLjMyNjE4IDIuOTM4ODUsLTIuOTYyNzIgdiAwIC01LjcwNDQzIGMgMCwtMS42MzY1NCAtMS4zMTQ2NywtMi45NjUwOCAtMi45Mzg4NSwtMi45NjUwOCB2IDAgeiBtIDExMS4wMjMzMiwxLjk1ODU2IGMgLTIuOTM5MTksMCAtNS4zMjI4MywyLjQwMjIzIC01LjMyMjgzLDUuMzY1MjcgdiAwIDEwLjMzMTQ0IGMgMCwyLjk2NTA5IDIuMzgzNjQsNS4zNjkzOCA1LjMyMjgzLDUuMzY5MzggdiAwIGggMTAuNTcxNTEgYyAyLjkzOTUzLDAgNS4zMjExMSwtMi40MDQyOSA1LjMyMTExLC01LjM2OTM4IHYgMCAtMTAuMzMxNDQgYyAwLC0yLjk2MzA0IC0yLjM4MTU4LC01LjM2NTI3IC01LjMyMTExLC01LjM2NTI3IHYgMCB6IG0gLTY1LjY3MDEyLDAgYyAtMi45MzgxNywwIC01LjMyMjE2LDIuNDAyMjMgLTUuMzIyMTYsNS4zNjUyNyB2IDAgMTAuMzMxNDQgYyAwLDIuOTY1MDkgMi4zODM5OSw1LjM2OTM4IDUuMzIyMTYsNS4zNjkzOCB2IDAgaCAxMC41NzA4IGMgMi45Mzc4MSwwIDUuMzIyODMsLTIuNDA0MjkgNS4zMjI4MywtNS4zNjkzOCB2IDAgLTEwLjMzMTQ0IGMgMCwtMi45NjMwNCAtMi4zODUwMiwtNS4zNjUyNyAtNS4zMjI4MywtNS4zNjUyNyB2IDAgeiBtIDkyLjg2NDcyLDcuOTkyNTkgYyAtMi4xODU5MiwwIC0zLjk1Nzc5LDEuNzkxMzkgLTMuOTU3NzksMy45OTgzNCB2IDAgNy42ODI4OCBjIDAsMi4yMDcyOSAxLjc3MTg3LDMuOTkxODQgMy45NTc3OSwzLjk5MTg0IHYgMCBoIDcuODY0NTMgYyAyLjE4NDU2LDAgMy45NTc4LC0xLjc4NDU1IDMuOTU3OCwtMy45OTE4NCB2IDAgLTcuNjgyODggYyAwLC0yLjIwNjk1IC0xLjc3MzI0LC0zLjk5ODM0IC0zLjk1NzgsLTMuOTk4MzQgdiAwIHogbSAtMTE3LjAwNDg2LDAgYyAtMi4xODUyOCwwIC0zLjk1OTE5LDEuNzkxMzkgLTMuOTU5MTksMy45OTgzNCB2IDAgNy42ODI4OCBjIDAsMi4yMDcyOSAxLjc3MzkxLDMuOTkxODQgMy45NTkxOSwzLjk5MTg0IHYgMCBoIDcuODYyMDggYyAyLjE4ODAyLDAgMy45NTk4NywtMS43ODQ1NSAzLjk1OTg3LC0zLjk5MTg0IHYgMCAtNy42ODI4OCBjIDAsLTIuMjA2OTUgLTEuNzcxODUsLTMuOTk4MzQgLTMuOTU5ODcsLTMuOTk4MzQgdiAwIHogbSAxNDAuMjQ2NDksNy40MjI4NSBjIC0xLjYyNTU1LDAgLTIuOTQwNTcsMS4zMjcyIC0yLjk0MDU3LDIuOTYzNzQgdiAwIDUuNzA0NDMgYyAwLDEuNjMzNDYgMS4zMTUwMiwyLjk2NTEgMi45NDA1NywyLjk2NTEgdiAwIEggMzA4LjY1IGMgMS42MjA3MiwwIDIuOTM0NjksLTEuMzMxNjQgMi45MzQ2OSwtMi45NjUxIHYgMCAtNS43MDQ0MyBjIDAsLTEuNjM2NTQgLTEuMzEzOTcsLTIuOTYzNzQgLTIuOTM0NjksLTIuOTYzNzQgdiAwIHogbSAtMTYxLjQ1OTU1LDAgYyAtMS42MjMxNywwIC0yLjkzODE2LDEuMzI3MiAtMi45MzgxNiwyLjk2Mzc0IHYgMCA1LjcwNDQzIGMgMCwxLjYzMzQ2IDEuMzE0OTksMi45NjUxIDIuOTM4MTYsMi45NjUxIHYgMCBoIDUuODM0OTEgYyAxLjYyNDE4LDAgMi45Mzg4NSwtMS4zMzE2NCAyLjkzODg1LC0yLjk2NTEgdiAwIC01LjcwNDQzIGMgMCwtMS42MzY1NCAtMS4zMTQ2NywtMi45NjM3NCAtMi45Mzg4NSwtMi45NjM3NCB2IDAgeiBtIDE4MC43MzA5Niw1LjY5OTk5IGMgLTEuMjI1MjgsMCAtMi4yMjA3OCwxLjAwMTAzIC0yLjIyMDc4LDIuMjM2NDIgdiAwIDQuMzAzNTggYyAwLDEuMjMxNjEgMC45OTU1LDIuMjM0NzEgMi4yMjA3OCwyLjIzNDcxIHYgMCBoIDQuNDAyOTMgYyAxLjIyMDQ4LDAgMi4yMTUyNiwtMS4wMDMxIDIuMjE1MjYsLTIuMjM0NzEgdiAwIC00LjMwMzU4IGMgMCwtMS4yMzUzOSAtMC45OTQ3OCwtMi4yMzY0MiAtMi4yMTUyNiwtMi4yMzY0MiB2IDAgeiBtIC0xOTguNTY3NjMsMCBjIC0xLjIyNDYxLDAgLTIuMjE4NzIsMS4wMDEwMyAtMi4yMTg3MiwyLjIzNjQyIHYgMCA0LjMwMzU4IGMgMCwxLjIzMTYxIDAuOTk0MTEsMi4yMzQ3MSAyLjIxODcyLDIuMjM0NzEgdiAwIGggNC40MDAxNiBjIDEuMjI0OTQsMCAyLjIxNjMsLTEuMDAzMSAyLjIxNjMsLTIuMjM0NzEgdiAwIC00LjMwMzU4IGMgMCwtMS4yMzUzOSAtMC45OTEzNiwtMi4yMzY0MiAtMi4yMTYzLC0yLjIzNjQyIHYgMCB6IgogICAgICAgaWQ9InBhdGg4MzYiCiAgICAgICBzdHlsZT0ic3Ryb2tlLXdpZHRoOjAuMzg5ODMzIiAvPgogICAgPGcKICAgICAgIGlkPSJnMTQwMCI+CiAgICAgIDxwYXRoCiAgICAgICAgIHN0eWxlPSJmaWxsOnVybCgjbGluZWFyR3JhZGllbnQxNDc4KTtmaWxsLW9wYWNpdHk6MTtzdHJva2Utd2lkdGg6My4wNTc3OCIKICAgICAgICAgZD0iTSAxNjcuOTI5NjksMC4wMDI4MTA4MiBDIDE1My45MTM4NSwwLjA2NzkzNDM0IDE0MC41MjkwOCwxLjI2MzI4ODEgMTI4Ljc1MTg1LDMuMzQ3MjYwOSA5NC4wNTc1ODYsOS40NzY1ODE5IDg3Ljc1ODQ2MSwyMi4zMDU4MTUgODcuNzU4NDYxLDQ1Ljk2NTA5OSBWIDc3LjIxMTgxNiBIIDE2OS43NDUyNCBWIDg3LjYyNzM4MiBIIDg3Ljc1ODQ2MSA1Ni45ODk1MyBjIC0yMy44Mjc2NDksMCAtNDQuNjkxODE1LDE0LjMyMTc5OCAtNTEuMjE3ODQ2Miw0MS41NjY3MzggLTcuNTI3NzE4MiwzMS4yMjkgLTcuODYxNjI3OCw1MC43MTY0MyAwLDgzLjMyNDU2IDUuODI3ODgwMiwyNC4yNzIyIDE5Ljc0NTc0MzIsNDEuNTY2NzMgNDMuNTczMzkyMiw0MS41NjY3MyBoIDI4LjE4ODkyMiB2IC0zNy40NTc4MyBjIDAsLTI3LjA2MTA3IDIzLjQxMzg2MiwtNTAuOTMxMiA1MS4yMTc4NTIsLTUwLjkzMTIgaCA4MS44OTEyMyBjIDIyLjc5NTYxLDAgNDAuOTkzMzksLTE4Ljc2OTE4IDQwLjk5MzM5LC00MS42NjIyOCBWIDQ1Ljk2NTA5OSBjIDAsLTIyLjIxODg4NyAtMTguNzQ0MTUsLTM4LjkwOTYwMjIgLTQwLjk5MzM5LC00Mi42MTc4MzgxIEMgMTk2LjU1ODk3LDEuMDAyNzYzOCAxODEuOTQ1NDksLTAuMDYyMzEyNyAxNjcuOTI5NjksMC4wMDI4MTA4MiBaIE0gMTIzLjU5MTg0LDI1LjEzMzk1NyBjIDguNDY4NjYsMCAxNS4zODQ0Nyw3LjAyODc4IDE1LjM4NDQ3LDE1LjY3MTEzNSAtM2UtNSw4LjYxMTcyNCAtNi45MTU4MSwxNS41NzU1ODMgLTE1LjM4NDQ3LDE1LjU3NTU4MyAtOC40OTkwNCwwIC0xNS4zODQ0NiwtNi45NjM4NTkgLTE1LjM4NDQ2LC0xNS41NzU1ODMgLTNlLTUsLTguNjQyMzU1IDYuODg1NDIsLTE1LjY3MTEzNSAxNS4zODQ0NiwtMTUuNjcxMTM1IHoiCiAgICAgICAgIGlkPSJwYXRoMTk0OCIgLz4KICAgICAgPHBhdGgKICAgICAgICAgc3R5bGU9ImZpbGw6dXJsKCNsaW5lYXJHcmFkaWVudDE0NzUpO2ZpbGwtb3BhY2l0eToxO3N0cm9rZS13aWR0aDozLjA1MTU3IgogICAgICAgICBkPSJtIDM3Mi4xMTIyOCwxOTQuNDg2IHYgMzYuMzMyNzYgYyAwLDI4LjE2ODI4IC0yMy44ODEyOCw1MS44NzY2OSAtNTEuMTEzNzksNTEuODc2NjkgaCAtODEuNzI0ODcgYyAtMjIuMzg1ODMsMCAtNDAuOTEwMTEsMTkuMTU5MjIgLTQwLjkxMDExLDQxLjU3NzY0IHYgNzcuOTEwNCBjIDAsMjIuMTczNzQgMTkuMjgxNTksMzUuMjE2MDkgNDAuOTEwMTEsNDEuNTc3NjQgMjUuODk5NjksNy42MTU1MyA1MC43MzYxMSw4Ljk5MTg1IDgxLjcyNDg3LDAgMjAuNTk4NTUsLTUuOTYzOTUgNDAuOTEwMSwtMTcuOTY2NDUgNDAuOTEwMSwtNDEuNTc3NjQgdiAtMzEuMTgzMjQgaCAtODEuNzI0ODYgdiAtMTAuMzk0NCBoIDgxLjcyNDg2IDQwLjkxMDExIGMgMjMuNzc5MjQsMCAzMi42NDAzNiwtMTYuNTg2NTMgNDAuOTEwMDgsLTQxLjQ4MjI5IDguNTQyMzYsLTI1LjYyOTggOC4xNzg4OCwtNTAuMjc2OTggMCwtODMuMTU1MjcgQyA0MzcuODUyMTMsMjEyLjI5NTkyIDQyNi42MjgxOCwxOTQuNDg2IDQwMi44MTg3LDE5NC40ODYgWiBtIC00NS45NjQyNywxOTcuMzAzMDggYyA4LjQ4MTc1LDAgMTUuMzUzMjEsNi45NDk3MSAxNS4zNTMyMSwxNS41NDM5NCAtM2UtNSw4LjYyNDggLTYuODcxNDYsMTUuNjM5MjkgLTE1LjM1MzIxLDE1LjYzOTI5IC04LjQ1MTUxLDAgLTE1LjM1MzIxLC03LjAxNDQ5IC0xNS4zNTMyMSwtMTUuNjM5MjkgMCwtOC41OTQyMyA2LjkwMTcsLTE1LjU0Mzk0IDE1LjM1MzIxLC0xNS41NDM5NCB6IgogICAgICAgICBpZD0icGF0aDE5NTAiIC8+CiAgICA8L2c+CiAgPC9nPgo8L3N2Zz4K"
    return [logo32b64, logo64b64, svgb64]

def setup_kernel():
    home = os.environ.get("HOME", "").rstrip("/")
    kernel_path = f"{home}/.local/share/jupyter/kernels/slurm-provisioner-kernel"
    if not os.path.exists(kernel_path):
        dirname = os.path.dirname(kernel_path)
        if not os.path.exists(dirname):
            os.makedirs(dirname)
        use_default = True
        # Create kernel in users home directory
        if os.environ.get("SLURMEL_TEMPLATE_PATH", None):
            # Use template
            try:
                shutil.copytree(os.environ["SLURMEL_TEMPLATE_PATH"], kernel_path)
                use_default = False
            except:
                pass
        if use_default:
            # Template Path is not set or copytree failed
            os.makedirs(kernel_path, exist_ok=True)
            with open(f"{kernel_path}/kernel.json", "w") as f:
                f.write(json.dumps(default_kernel(), indent=4, sort_keys=True))
            logos = default_logos()
            with open(f"{kernel_path}/logo-32x32.png", "wb") as f:
                f.write(base64.b64decode(logos[0]))
            with open(f"{kernel_path}/logo-64x64.png", "wb") as f:
                f.write(base64.b64decode(logos[1]))
            with open(f"{kernel_path}/logo-svg.svg", "wb") as f:
                f.write(base64.b64decode(logos[2]))
   

def setup_handlers(web_app):
    host_pattern = ".*$"
    base_url = web_app.settings["base_url"]
    configure_route = url_path_join(base_url, "slurm-provisioner", "configure")
    updatelocal_route = url_path_join(base_url, "slurm-provisioner", "local")
    updateall_route = url_path_join(base_url, "slurm-provisioner", "all")
    configure = [(configure_route, ConfigureHandler)]
    local = [(updatelocal_route, UpdateLocalFiles)]
    all = [(updateall_route, UpdateAll)]
    web_app.add_handlers(host_pattern, configure)
    web_app.add_handlers(host_pattern, local)
    web_app.add_handlers(host_pattern, all)