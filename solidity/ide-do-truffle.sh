echo "Check for GANACHE environment variables:"
env | grep GANACHE
export PATH="/home/robert/.nvm/versions/node/v10.14.2/bin:/home/robert/.sdkman/candidates/springboot/current/bin:/home/robert/.sdkman/candidates/maven/current/bin:/home/robert/.sdkman/candidates/java/current/bin:/home/robert/.sdkman/candidates/gradle/current/bin:/home/robert/go/bin:/bin:/home/robert/Documents/AndroidBridge/platform-tools:/home/robert/Programs/gactions:/home/robert/.local/share/umake/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games:/usr/local/games:/snap/bin:/usr/lib/jvm/java-8-oracle/bin:/usr/lib/jvm/java-8-oracle/db/bin:/usr/lib/jvm/java-8-oracle/jre/bin"
echo $PATH

# First argument should be the operation name.
OPERATION_NAME=$1
if [ -z "${OPERATION_NAME}" ]; then
  echo "OPERATION_NAME is missing."
  exit 1
fi
echo "OPERATION_NAME is: $OPERATION_NAME"

# First argument should be the network name.
NETWORK_NAME=$2
if [ -z "${NETWORK_NAME}" ]; then
  echo "NETWORK_NAME is missing."
  exit 1
fi

truffle $OPERATION_NAME --network $NETWORK_NAME