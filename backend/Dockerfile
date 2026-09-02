# --- Stage 1: Java-App bauen ---
FROM eclipse-temurin:21-jdk-noble AS app-builder
WORKDIR /app
COPY . .
RUN ./mvnw clean package -DskipTests

# --- Stage 2: libkeyfinder + keyfinder-cli kompilieren (exakt nach README) ---
FROM eclipse-temurin:21-jdk-noble AS tools-builder
RUN apt-get update && apt-get install -y \
    build-essential cmake pkg-config git \
    libavformat-dev libavcodec-dev libavutil-dev libswresample-dev libfftw3-dev \
    && rm -rf /var/lib/apt/lists/*

RUN git clone --depth 1 https://github.com/mixxxdj/libkeyfinder.git /tmp/libkeyfinder \
    && cmake -B /tmp/libkeyfinder/build -S /tmp/libkeyfinder -DBUILD_TESTING=OFF -DCMAKE_BUILD_TYPE=Release \
    && cmake --build /tmp/libkeyfinder/build \
    && cmake --install /tmp/libkeyfinder/build \
    && ldconfig

RUN git clone --depth 1 https://github.com/EvanPurkhiser/keyfinder-cli.git /tmp/keyfinder-cli \
    && cmake -B /tmp/keyfinder-cli/build -S /tmp/keyfinder-cli -DCMAKE_BUILD_TYPE=Release \
    && cmake --build /tmp/keyfinder-cli/build \
    && cmake --install /tmp/keyfinder-cli/build

# --- Stage 3: Runtime-Image ---
FROM eclipse-temurin:21-jre-noble
RUN apt-get update && apt-get install -y \
    ffmpeg aubio-tools \
    && rm -rf /var/lib/apt/lists/*

# kompilierte libkeyfinder + keyfinder-cli aus Stage 2 übernehmen
COPY --from=tools-builder /usr/local/bin/keyfinder-cli /usr/local/bin/keyfinder-cli
COPY --from=tools-builder /usr/local/lib/libkeyfinder* /usr/local/lib/
RUN ldconfig

WORKDIR /app
COPY --from=app-builder /app/target/*.jar app.jar

VOLUME ["/app/data"]
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]