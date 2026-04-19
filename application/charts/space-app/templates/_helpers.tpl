{{- define "space-app.name" -}}
{{- default "space-app" .Chart.Name -}}
{{- end -}}

{{- define "space-app.fullname" -}}
{{- printf "%s-%s" .Release.Name (include "space-app.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "space-app.labels" -}}
app.kubernetes.io/name: {{ include "space-app.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version }}
{{- end -}}

{{- define "space-app.backend.image" -}}
{{- $tag := default .Chart.AppVersion .Values.backend.image.tag -}}
{{ printf "%s:%s" .Values.backend.image.repository $tag }}
{{- end -}}

{{- define "space-app.frontend.image" -}}
{{- $tag := default .Chart.AppVersion .Values.frontend.image.tag -}}
{{ printf "%s:%s" .Values.frontend.image.repository $tag }}
{{- end -}}
